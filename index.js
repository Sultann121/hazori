
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const knex = require('knex')({
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://localhost/hazori'
});

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const ADMIN_CODE = process.env.ADMIN_CODE || '1234567890';
const CENTER_LAT = 25.8969550;
const CENTER_LNG = 43.5497960;
const RADIUS_M = 100;

async function init() {
  if(!await knex.schema.hasTable('trainers')){
    await knex.schema.createTable('trainers', t=>{
      t.increments('id');
      t.string('national_id').unique();
      t.string('training_id');
      t.string('name');
      t.string('phone');
      t.string('department');
      t.string('device_id');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
  if(!await knex.schema.hasTable('attendance')){
    await knex.schema.createTable('attendance', t=>{
      t.increments('id');
      t.integer('trainer_id');
      t.timestamp('timestamp').defaultTo(knex.fn.now());
      t.decimal('lat',10,7);
      t.decimal('lng',10,7);
    });
  }
  if(!await knex.schema.hasTable('config')){
    await knex.schema.createTable('config', t=>{
      t.string('key').primary();
      t.text('value');
    });
    await knex('config').insert({key:'attendance_open', value:'false'}).onConflict('key').merge();
  }
}
init().catch(e=>console.error('Init error', e));

function haversine(lat1, lon1, lat2, lon2) {
  function toRad(x){ return x*Math.PI/180; }
  const R = 6371000;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

app.get('/api/config', async (req,res)=>{
  const row = await knex('config').where({key:'attendance_open'}).first();
  res.json({attendance_open: row ? row.value==='true' : false});
});

app.post('/api/config/toggle', async (req,res)=>{
  const {admin_code, open} = req.body;
  if(admin_code !== ADMIN_CODE) return res.status(403).json({error:'Unauthorized'});
  await knex('config').insert({key:'attendance_open', value: open ? 'true' : 'false'}).onConflict('key').merge();
  res.json({ok:true});
});

app.post('/api/trainers', async (req,res)=>{
  const {national_id, training_id, name, phone, department, device_id} = req.body;
  try{
    const [id] = await knex('trainers').insert({national_id, training_id, name, phone, department, device_id}).returning('id');
    res.json({ok:true,id});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

const upload = multer({ dest: 'uploads/' });
app.post('/api/trainers/import', upload.single('file'), async (req,res)=>{
  const path = req.file.path;
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  for(const r of data){
    try{
      await knex('trainers').insert({
        national_id: String(r.national_id || r['الهوية'] || r.nationalId),
        training_id: r.training_id || r['رقم_التدريب'],
        name: r.name || r['الاسم'],
        phone: r.phone || r['الجوال'],
        department: r.department || r['القسم']
      });
    }catch(e){ /* ignore duplicates */ }
  }
  fs.unlinkSync(path);
  res.json({ok:true});
});

app.post('/api/attendance', async (req,res)=>{
  const {national_id, lat, lng, device_id} = req.body;
  const cfg = await knex('config').where({key:'attendance_open'}).first();
  if(!cfg || cfg.value !== 'true') return res.status(400).json({error:'Attendance is closed'});
  const dist = haversine(CENTER_LAT, CENTER_LNG, parseFloat(lat), parseFloat(lng));
  if(dist > RADIUS_M) return res.status(400).json({error:'You are outside allowed area', dist});
  const trainer = await knex('trainers').where({national_id}).first();
  if(!trainer) return res.status(404).json({error:'Not registered'});
  if(device_id){
    const other = await knex('trainers').where({device_id}).first();
    if(other && other.national_id !== national_id) return res.status(400).json({error:'Device already used for another account'});
  }
  if(!trainer.device_id && device_id) {
    await knex('trainers').where({id: trainer.id}).update({device_id});
  }
  const today = new Date(); today.setHours(0,0,0,0);
  const exists = await knex('attendance').where('trainer_id', trainer.id).andWhere('timestamp','>=', today).first();
  if(exists) return res.status(400).json({error:'Already marked today'});
  await knex('attendance').insert({trainer_id: trainer.id, lat, lng});
  res.json({ok:true});
});

app.get('/api/reports/pdf', async (req,res)=>{
  const dept = req.query.department;
  let q = knex('attendance')
    .join('trainers','attendance.trainer_id','trainers.id')
    .select('trainers.name','trainers.national_id','trainers.training_id','trainers.department','attendance.timestamp')
    .orderBy('trainers.department');
  if(dept && dept !== 'all') q = q.where('trainers.department', dept);
  const rows = await q;
  const doc = new PDFDocument({size:'A4', margin:50});
  res.setHeader('Content-disposition', `attachment; filename=report_${dept||'all'}.pdf`);
  res.setHeader('Content-type', 'application/pdf');
  doc.pipe(res);
  if(!dept || dept === 'all'){
    const groups = {};
    rows.forEach(r=>{
      groups[r.department] = groups[r.department] || [];
      groups[r.department].push(r);
    });
    let first = true;
    for(const dep of Object.keys(groups)){
      if(!first) doc.addPage();
      first = false;
      doc.fontSize(16).text(`قائمة حضور - ${dep}`, {align:'center'});
      doc.moveDown();
      groups[dep].forEach((r,i)=>{
        doc.fontSize(12).text(`${i+1}. ${r.name} — الهوية: ${r.national_id} — رقم تدريبي: ${r.training_id} — الوقت: ${r.timestamp}`);
      });
    }
  } else {
    doc.fontSize(16).text(`قائمة حضور - ${dept}`, {align:'center'});
    doc.moveDown();
    rows.forEach((r,i)=>{
      doc.fontSize(12).text(`${i+1}. ${r.name} — الهوية: ${r.national_id} — رقم تدريبي: ${r.training_id} — الوقت: ${r.timestamp}`);
    });
  }
  doc.end();
});

app.get('/api/stats', async (req,res)=>{
  const totalRow = await knex('attendance').count('* as cnt').first();
  const total = totalRow ? parseInt(totalRow.cnt) : 0;
  const perDept = await knex('attendance')
    .join('trainers','attendance.trainer_id','trainers.id')
    .select('trainers.department')
    .count('attendance.id as cnt')
    .groupBy('trainers.department');
  res.json({total, perDept});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server on', PORT));
