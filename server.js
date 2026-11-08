require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteSession = require("connect-sqlite3")(session);
const SQLiteStore = require("better-sqlite3"); // SQLite database
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
app.set("trust proxy", 1);
const app = express();
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || !process.env.ADMIN_PASSWORD)) {
  throw new Error("Production চালুর আগে SESSION_SECRET ও ADMIN_PASSWORD সেট করুন");
}
const DB = new SQLiteStore("store.db");
const uploads = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploads, { recursive: true });

DB.exec(`
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
 price INTEGER NOT NULL, old_price INTEGER DEFAULT 0, sizes TEXT DEFAULT '',
 description TEXT DEFAULT '', image TEXT DEFAULT '', stock INTEGER DEFAULT 0,
 active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, customer TEXT NOT NULL, phone TEXT NOT NULL,
 address TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL,
 payment TEXT NOT NULL, trx TEXT DEFAULT '', status TEXT DEFAULT 'নতুন',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS banners (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, subtitle TEXT DEFAULT '',
 image TEXT DEFAULT '', active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT);
`);JRS-JOSHIM-9xK7pQ4mV8nR2tL6wB5zH3cD
const adminUser = process.env.ADMIN_USERNAME || "Joshim0077";
const adminPass = process.env.ADMIN_PASSWORD;JRS-JOSHIM-9xK7pQ4mV8nR2tL6wB5zH3cD
if (!DB.prepare("SELECT id FROM admins WHERE username=?").get(adminUser) && adminPass) {
  DB.prepare("INSERT INTO admins(username,password) VALUES(?,?)").run(adminUser, bcrypt.hashSync(adminPass, 12));
}
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "PLEASE_CHANGE_THIS_SESSION_SECRET",
  store: new SQLiteSession({ db: "sessions.sqlite", dir: __dirname }),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8*60*60*1000 }
}));
const loginLimiter = rateLimit({ windowMs: 15*60*1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const storage = multer.diskStorage({
 destination: (_,__,cb)=>cb(null,uploads),
 filename: (_,file,cb)=>cb(null,crypto.randomBytes(12).toString("hex")+path.extname(file.originalname).toLowerCase())
});
const upload = multer({ storage, limits:{fileSize:5*1024*1024}, fileFilter:(_,f,cb)=>cb(null,/^image\/(jpeg|png|webp)$/.test(f.mimetype)) });
const auth = (req,res,next)=>req.session.admin ? next() : res.status(401).json({error:"লগইন প্রয়োজন"});
app.get("/api/config",(_,res)=>res.json({
 storeName: process.env.STORE_NAME || "JRS JOSHIM",
 bkash: process.env.BKASH_NUMBER || "",
 nagad: process.env.NAGAD_NUMBER || ""
}));
app.get("/api/products",(_,res)=>{
 const rows=DB.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all();
 res.json(rows.map(p=>({...p,sizes:p.sizes.split(",").filter(Boolean)})));
});
app.post("/api/orders",(req,res)=>{
 const {customer,phone,address,items,payment,trx=""}=req.body||{};
 if(!customer||!phone||!address||!Array.isArray(items)||!items.length||!["COD","BKASH","NAGAD"].includes(payment))
   return res.status(400).json({error:"সব তথ্য সঠিকভাবে দিন"});
 const ids=items.map(x=>Number(x.id));
 const products=DB.prepare(`SELECT * FROM products WHERE active=1 AND id IN (${ids.map(()=>"?").join(",")})`).all(...ids);
 let total=0, clean=[];
 for(const item of items){
   const p=products.find(x=>x.id===Number(item.id)), qty=Math.max(1,Math.min(20,Number(item.qty)||1));
   if(!p||p.stock<qty) return res.status(400).json({error:"কোনো পণ্যের স্টক পর্যাপ্ত নেই"});
   total+=p.price*qty; clean.push({id:p.id,name:p.name,price:p.price,qty});
 }
 const tx=DB.transaction(()=>{
   for(const it of clean) DB.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(it.qty,it.id);
   return DB.prepare("INSERT INTO orders(customer,phone,address,items,total,payment,trx) VALUES(?,?,?,?,?,?,?)")
    .run(customer,phone,address,JSON.stringify(clean),total,payment,String(trx).slice(0,80)).lastInsertRowid;
 });
 const id=tx(); res.json({ok:true,orderId:id,total});
});
app.post("/api/admin/login",loginLimiter,(req,res)=>{
 const {username,password}=req.body||{};
 const row=DB.prepare("SELECT * FROM admins WHERE username=?").get(username||"");
 if(!row||!bcrypt.compareSync(password||"",row.password)) return res.status(401).json({error:"ইউজারনেম বা পাসওয়ার্ড ভুল"});
 req.session.admin={id:row.id,username:row.username}; res.json({ok:true});
});
app.post("/api/admin/logout",auth,(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/admin/me",(req,res)=>res.json({loggedIn:!!req.session.admin,username:req.session.admin?.username||""}));
app.get("/api/admin/products",auth,(_,res)=>res.json(DB.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/upload",auth,upload.single("image"),(req,res)=>{
 if(!req.file) return res.status(400).json({error:"JPG, PNG বা WEBP ছবি দিন (সর্বোচ্চ 5MB)"});
 res.json({url:"/uploads/"+req.file.filename});
});
app.post("/api/admin/products",auth,(req,res)=>{
 const p=req.body||{};
 if(!p.name||!p.category||!Number.isFinite(Number(p.price))||Number(p.price)<1) return res.status(400).json({error:"নাম, ক্যাটাগরি ও সঠিক দাম দিন"});
 const result=DB.prepare("INSERT INTO products(name,category,price,old_price,sizes,description,image,stock) VALUES(?,?,?,?,?,?,?,?)")
 .run(p.name,p.category,Number(p.price),Number(p.old_price)||0,String(p.sizes||""),String(p.description||""),String(p.image||""),Math.max(0,Number(p.stock)||0));
 res.json({ok:true,id:result.lastInsertRowid});
});
app.put("/api/admin/products/:id",auth,(req,res)=>{
 const p=req.body||{};
 DB.prepare("UPDATE products SET name=?,category=?,price=?,old_price=?,sizes=?,description=?,image=?,stock=?,active=? WHERE id=?")
 .run(p.name,p.category,Number(p.price),Number(p.old_price)||0,String(p.sizes||""),String(p.description||""),String(p.image||""),Math.max(0,Number(p.stock)||0),p.active===false?0:1,Number(req.params.id));
 res.json({ok:true});
});
app.delete("/api/admin/products/:id",auth,(req,res)=>{DB.prepare("DELETE FROM products WHERE id=?").run(Number(req.params.id));res.json({ok:true});});
app.get("/api/admin/orders",auth,(_,res)=>res.json(DB.prepare("SELECT * FROM orders ORDER BY id DESC").all().map(o=>({...o,items:JSON.parse(o.items)}))));
app.patch("/api/admin/orders/:id",auth,(req,res)=>{
 const allowed=["নতুন","নিশ্চিত","প্রসেসিং","পাঠানো হয়েছে","সম্পন্ন","বাতিল"];
 if(!allowed.includes(req.body.status)) return res.status(400).json({error:"অবস্থা সঠিক নয়"});
 DB.prepare("UPDATE orders SET status=? WHERE id=?").run(req.body.status,Number(req.params.id));res.json({ok:true});
});
app.get("/api/admin/banners",auth,(_,res)=>res.json(DB.prepare("SELECT * FROM banners ORDER BY id DESC").all()));
app.post("/api/admin/banners",auth,(req,res)=>{
 const b=req.body||{}; if(!b.title) return res.status(400).json({error:"বিজ্ঞাপনের শিরোনাম দিন"});
 DB.prepare("INSERT INTO banners(title,subtitle,image) VALUES(?,?,?)").run(b.title,b.subtitle||"",b.image||"");res.json({ok:true});
});
app.delete("/api/admin/banners/:id",auth,(req,res)=>{DB.prepare("DELETE FROM banners WHERE id=?").run(Number(req.params.id));res.json({ok:true});});
app.use(express.static(path.join(__dirname,"public")));
app.listen(PORT,()=>console.log(`JRS JOSHIM running on port ${PORT}`));
