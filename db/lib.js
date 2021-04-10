var User=require('../db/model_user');
var Message=require('../db/model_message');
var Room=require('../db/model_room');
var User_attr=require('../db/model_user_attr');
var crypto=require('crypto');
const { v4: uuidv4 } = require('uuid');

//check if user logined
//cookie_logined,cookie_name
exports.auth=async(cookie_logined,cookie_name)=>{
	if(cookie_logined){
		let user=await User.findOne({account: cookie_name});
		if(user){
			return 200;
		}
		else{
			return 404;
		}
	}
	else{
		return 204;
	}
}

var setname=(member)=>{
	let name=member[0];
	for(let i=1;i<member.length;i++){
		name+=",";
		name+=member[i];
	}
	return name;
}
var init_msg=async(member,num)=>{
	let sender="system";
	let msg_base=" has attended the room";
	for(let i=0;i<member.length;i++){
		let content=member[i]+msg_base;
		let new_msg=new Message({
			account: sender,
			content: content,
			room: num,
			createdate: Date.now(),
			last_read: null
		});
		await new_msg.save((err)=>{
			if(err){
				console.log(`can't save ${member[i]} msg at init_msg`);
			}
		})
	}
}

//input: member(array)
exports.createroom=async(member)=>{
	let num=uuidv4();
	let name=setname(member);
	if(!name){
		console.log("no name at createroom");
		return false;
	}
	if(member.length<=2){
		let new_room=new Room({
			num: num,
			name: name,
			last_msg: Date.now(),
			single: true,
			member: member
		});
		await new_room.save((err)=>{
			if(err){
				console.log("can't save Room at create room");
				return false;
			}
		});
	}
	else{
		let new_room=new Room({
			num: num,
			name: name,
			last_msg: Date.now(),
			single: false,
			member: member
		});
		await new_room.save((err)=>{
			if(err){
				console.log("can't save Room at create room");
				return false;
			}
		});
	}
	init_msg(member,num);
	return num;
}
exports.appendroom=(member,room)=>{
	for(let i=0;i<member.length;i++){
		User.updateOne({account: member[i]},{$push: {rooms: room}},(err)=>{
			if(err){
				console.log(`${member[i]} err at appendroom`);
			}
		})
	}
}
exports.appendfriend=(friend,myname)=>{
	User.updateOne({account: friend},{$push: {friends: myname}},(err)=>{
		if(err){
			console.log("add myname to friend err at appendfriend");
		}
	});
	User.updateOne({account: myname},{$push: {friends: friend}},(err)=>{
		if(err){
			console.log("add friend to myname err at appendfriend");
		}
	});
}

exports.create_crypto=(value,secret)=>{
	let str=crypto.createHmac('sha256',secret).update(value).digest('hex');
	return str;
}

exports.save_msg=async(content,name,room)=>{
	let new_msg=new Message({
		account: name,
		content: content,
		room: room,
		createdate: Date.now(),
		last_read: null
	});
	await new_msg.save((err)=>{
		if(err){
			console.log("save msg error at save_msg");
		}
	});
	await Room.updateOne({num: room},{$set: {last_msg: Date.now()}},(err)=>{
		if(err){
			console.log("error update pwd at chpwd");
		}
	});
	return new_msg;
}

exports.exit_msg=async(room,name)=>{
	let content=name+" has left the room";
	let new_msg=new Message({
		account: "system",
		content: content,
		room: room,
		createdate: Date.now(),
		last_read: null
	});
	await new_msg.save((err)=>{
		if(err){
			console.log("save msg err at exit_msg");
		}
	});
}

