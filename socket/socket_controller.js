var User=require('../db/model_user');
var Message=require('../db/model_message');
var Room=require('../db/model_room');
var User_Attr=require('../db/model_user_attr');
const { v4: uuidv4 } = require('uuid');
var lib=require('../db/lib');


//check if room & user exist
var check_exist=async(name,room)=>{
	let result;
	await User.findOne({account: name},(err,user)=>{
		if(err){
			console.log(`error at check_exist ${err}`);
			result=500;
		}
		else if(!user){
			//cookie logined=false
			//redirect to login
			console.log("user not exist at init_data");
			result=404;
		}
		else if(!room){
			console.log("no room at init_data");
			//resend room
			result=204;
		}
		else if(!user.rooms.includes(room)){
			//set page 404 not found
			console.log("room not exist at init_data");
			result=404;
		}
		else{
			result=user;
		}
	});
	return result;
}

//retrun object of Room
var load_room=async(user,room)=>{
	let result;
	await Room.find({member: user.account},(err,rooms)=>{
		if(err){
			console.log("load room error at init_data");
			result=500;
		}
		else{
			result=rooms;
		}
	});
	for(let i=0;i<result.length;i++){
		await Message.find({room: result[i].num}).sort({createdate: 'asc'}).limit(1).exec((err,message)=>{
			result[i].message=message;
		});
	}
	return result;
}

//give origin rooms{rooms[i].num:member}
var check_origin=(rooms)=>{
	let origin_rooms=new Object();
	for(let i=0;i<rooms.length;i++){
		if(rooms[i].single===true){
			origin_rooms[rooms[i].num]=rooms[i].member;
		}
	}
	return origin_rooms;
}

//return user.friends{user.friends[i]:href}
var load_friends=(user,origin_rooms)=>{
	let friends=new Object();
	for(let item in origin_rooms){
		for(let i=0;i<user.friends.length;i++){
			if(origin_rooms[item].includes(user.friends[i])){
				friends[user.friends[i]]=item;
			}
		}
	}
	return friends;
}

//return array[]
exports.friends_to_room=async(user_friends)=>{
	let friends_allow_room=[];
	await User_Attr.find({account:{$in:user_friends}},(err,user_attrs)=>{
		if(err){
			console.log(`error at friends_to_room ${err}`);
			return false;
		}
		for(let i=0;i<user_attrs.length;i++){
			if(user_attrs[i].allow_to_room===true){
				friends_allow_room.push(user_attrs[i].account);
			}
		}
	});
	return friends_allow_room;
}

//return msg [{},{}]
var load_messages=async(room,start_point)=>{
	let result;
	await Message.find({room: room},null,{sort: {createdate: 'desc'}},(err,messages)=>{
		if(err){
			console.log("load messages error at init_data");
			result=500;
		}
		else{
			let msg=messages.slice(start_point,start_point+30);
			result=msg;
		}
	});
	return result;
}

exports.init_data=async(name,room)=>{
	let user=await check_exist(name,room);
	let data=new Object();
	if(user){
		let rooms=await load_room(user,room);//get rooms
		let origin_rooms=await check_origin(rooms);
		let friends=await load_friends(user,origin_rooms);//get friends
		//let friends_allow_to_room=await friends_to_room(user.friends);//get friends(allow_to_room)
		let messages=await load_messages(room,0);//init messages
		if(rooms&&origin_rooms&&friends&&messages){
			data.rooms=rooms;
			data.friends=friends;
			//data.friends_allow_to_room=friends_allow_to_room;
			data.messages=messages;
		}
		return data;
	}	
}

var create_new_friend=async(friend,myname)=>{
	let result;
	await User.findOne({account: myname},async(err,user)=>{
		if(err){
			console.log("error at create_new_friend");
			result=500;
		}
		else if(!user){
			console.log("user not exist at create_new_friend");
			result=404;
		}
		else if(user.friends.includes(friend)){
			console.log("friend already exists at create_new_friend");
			result=302;
		}
		else{
			 let room=await lib.createroom([friend,myname]);
			 lib.appendroom([friend,myname],room);
			 lib.appendfriend(friend,myname);
			 result=200;
		}
	});
	return result;
}

exports.add_friend=async(friend,myname)=>{
	let result=200;
	await User.findOne({account: friend},async(err,new_friend)=>{
		if(err){
			console.log("error at find friend in add_friend");
			result=500;
		}
		else if(!new_friend){
			console.log("not found at find friend in add_friend");
			result=404;
		}
		else if(new_friend.allow_add_friend===false){
			console.log("not allow_add_friend at add_friend");
			result=401;			
		}
		else{
			let res_val=await create_new_friend(friend,myname);
			if(res_val===200){
				result=200;
			}
		}
	});//await error
	return result;
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

exports.add_member=async(member_add,room)=>{ //bug: will append two the same name at the same time
	let result;
	let member_to_add=[];
	await Room.findOne({num: room},(err,res_room)=>{
		for(let i=0;i<member_add.length;i++){
			if(!res_room.member.includes(member_add[i])){
				member_to_add.push(member_add[i]);
			}
		}
	});
	await Room.updateOne({num: room},{$push: {member: member_to_add}},(err)=>{
		if(err){
			console.log("update error at add_member");
			result=500;
		}
	});
	if(result!=500){
		for(let i=0;i<member_to_add.length;i++){
			await User.updateOne({account: member_to_add[i]},{$push: {rooms: room}},(err)=>{
				if(err){
					console.log(`error at update ${member_to_add[i]} at add_member`);
					result=500;
				}
			});
		}
	}
	await init_msg(member_to_add,room);
	if(result!=500){
		result=member_to_add;
	}
	return result;
}

exports.load_msg=async(room,msg_num)=>{
	let data=new Object();
	data.messages=await load_messages(room,msg_num);
	return data;
}

var cls_empty_room=(room)=>{
	Room.findOne({num: room},(err,res_room)=>{
		if(err){
			console.log("err at cls_empty_room");
		}
		else if(res_room.member.length===0){
			Message.deleteMany({room: room},(err)=>{
				if(err){
					console.log("deleteMany err message at cls_empty_room");
				}
			});
		}
	});
	Room.deleteOne({num: room},(err)=>{
		if(err){
			console.log("delete error at cls_empty_room");
		}
	})
} 

exports.drop_out_room=async(room,name)=>{
	let result=200;
	await Room.findOne({num: room},async(err,res_room)=>{
		if(err){
			console.log("error at drop_out_room");
			result=500;
		}
		else if(!res_room){
			console.log("not found at drop_out_room");
			result=404;
		}
		else{
			await User.findOne({account: name},async(err,user)=>{
				if(err){
					console.log("error at drop_out_room");
					result=500;
				}
				else if(!user){
					console.log("not found at drop_out_room");
					result=404;
				}
				else{
					await Room.updateOne({num: room},{$pull: {member: name}},(err)=>{
						if(err){
							console.log("update pull err room at drop_out_room");
							result=500;
						}
					});
					await User.updateOne({account: name},{$pull: {rooms: room}},(err)=>{
						if(err){
							console.log("update pull err user at drop_out_room");
							result=500;
						}
					});
					await cls_empty_room(room);
				}
			});
		}
	});
	return result;
}

exports.friend_data=(user,origin_rooms)=>{
	load_friends(user,origin_rooms);
}