var express=require('express');
var app=express();
var path=require('path');
var cookieSession=require('cookie-session');
const server=require("http").Server(app);
var io=require("socket.io")(server,{
	path:"/chat"
});
const multer=require("multer");

var lib=require("./db/lib");
var apis_controller=require("./apis_controller"); 

var fs = require('fs');
app.engine('jizz', function (filePath, options, callback) { // define the template engine
  fs.readFile(filePath, function (err, content) {
    if (err) return callback(new Error(err));
    // this is an extremely simple template engine
    var rendered = content.toString().replace('#name#', ''+ options.name +'')
    .replace('#room#', ''+ options.room +'').replace('#msg_num#',''+options.msg_num+'');
    return callback(null, rendered);
  });
});
app.set('views', './views'); // specify the views directory
app.set('view engine', 'jizz'); // register the template engine


//socket.io
var socket_connection=require("./socket/socket");
socket_connection(io);

//connect to db
var mongoose=require('mongoose');
mongoose.connect( "mongodb://127.0.0.1:27017/project",{ useNewUrlParser: true,useUnifiedTopology: true,useCreateIndex: true },()=>{
  console.log('connected to mongodb');
});
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
var User=require('./db/model_user');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
  name:'jizz',
  secret: "infor32nd"
}));

//pages
app.get("/",(req,res,next)=>{
  res.sendFile(__dirname+"/views/index.html");
});
app.get("/login",(req,res,next)=>{
  let auth=lib.auth(req.session.logined,req.session.name);
  if(auth===200){
  	res.redirect("/chat");
  }
  else{
  	res.sendFile(__dirname+"/views/login.html");
  }
});
app.get("/register",(req,res,next)=>{
  let auth=lib.auth(req.session.logined,req.session.name);
  if(auth===200){
  	res.redirect("/chat");
  }
  else{
  	res.sendFile(__dirname+"/views/register.html");
  }
});
app.get("/chat",async(req,res,next)=>{
  let auth=await lib.auth(req.session.logined,req.session.name);
  if(!req.query.room){  	
  	let num=await apis_controller.redirect_chat(req.session.name);
  	if((num!=404)&&(num!=500)){
  		res.redirect("/chat?room="+num);
  	}
  }
  else if(auth===200){
  	let msg_num;
  	if(!req.session.msg_num){
  		msg_num=0;
  	}
  	res.render("main",{name: req.session.name,room: req.query.room,msg_num: msg_num});
  }
  else{
  	res.redirect("/login");
  }
});
app.get("/settings",async(req,res,next)=>{
	let auth=await lib.auth(req.session.logined,req.session.name);
	if(auth===200){
		res.render("settings",{name: req.session.name});
	}
	else{
		res.redirect("/login");
	}
});
app.get("/logout",(req,res,next)=>{
	req.session.name=null;
	req.session.logined=false;
	res.redirect("/login");
});


//apis
app.post("/login",async(req,res,next)=>{
	let result=204;
	if(req.body.user&&req.body.passwd){
		result=await apis_controller.login(req.body.user,req.body.passwd);
	}	
	if(result===200){
		req.session.logined=true;
		req.session.name=req.body.user;
		res.redirect("/chat");
	}
	else if(result===404){
		res.redirect("/register");
	}
	else{
		res.redirect("/login");
	}
});
//something went wrong
app.post("/register",async(req,res,next)=>{
	let result=204;
	if(req.body.user&&req.body.passwd&&req.body.passwd_confirm){
		result=await apis_controller.register(req.body.user,req.body.passwd,req.body.passwd_confirm);
	}
	if(result===200){
		res.redirect("/login");
	}
	else{
		res.redirect("/register");
	}
});
app.post("/chpwd",async(req,res,next)=>{
	let result;
	if(req.body.old_pwd&&req.body.new_pwd&&req.body.new_pwd_again){
		let res_val=await apis_controller.chpwd(req.session.name,req.body.old_pwd,req.body.new_pwd,req.body.new_pwd_again);
		if(res_val===200){
			res.redirect("/logout");
		}
		else{
			res.redirect("/settings");
		}
	}
	else{
		res.redirect("/settings");
	}
});



server.listen(8080,()=>{
  console.log("listening...");
});
