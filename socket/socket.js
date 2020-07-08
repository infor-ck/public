var User=require('../db/model_user');
var Message=require('../db/model_message');
var Room=require('../db/model_room');
var User_attr=require('../db/model_user_attr');
var socket_controller=require('./socket_controller');
var lib=require('../db/lib');
const { v4: uuidv4 } = require('uuid');

module.exports=(io)=>{
	io.on("connection",(socket)=>{
		let name=socket.handshake.query.name;
		let room=socket.handshake.query.room;
		User.findOne({account: name},(err,user)=>{
			socket.join(user.rooms);
		});
		socket.on("get_init_data",async()=>{
			let data=await socket_controller.init_data(name,room);
			socket.emit('receive_data',data);			
		});
		socket.on("send_msg",async(content)=>{
			let res_val= await lib.save_msg(content,name,room);
			let data=new Object();
			data.messages=[res_val];
			data.send_msg=true;
			io.to(room).emit("receive_data",data);
		});
		//member(array)
		socket.on("createroom",async(member)=>{
			let data=new Object();
			let url="http://localhost:8080/chat?room=";
			data.room=await lib.createroom(member);
			await lib.appendroom(member,data.room);
			io.emit("auth",data);
			url+=data.room;
			socket.emit("rdurl",url);
		});
		socket.on("check",async(data)=>{
			if(data.room){
				await Room.findOne({num: data.room},async(err,room)=>{
					if(room.member.includes(name)){
						let result=new Object();
						result.rooms=room;
						await Message.find({room: data.room},null,{sort: {createdate: 'desc'}},(err,msg)=>{ //find last msg(need to be fixed)
							result.rooms.message=msg[0];
							socket.emit("receive_data",result);
						});
					}
				});
			}
			if(data.friend){
				if(data.friend.includes(name)){
					let result=new Object();
					await Room.findOne( { $and: [ {member: name}, {single: true} ,{member:{$size: 2}}]},(err,room)=>{
						for(let i=0;i<data.friend.length;i++){
							if(data.friend[i]!=name){
								result[data.friend[i]]=room.num;
							}
						}
					});
					socket.emit("receive_data",result);
				}
			}
		});
		socket.on("add_friend",async(friend)=>{
			let res_val=await socket_controller.add_friend(friend,name);
			if(res_val===200){
				let data=new Object();
				data.friend=[friend,name];
				io.emit("auth",data);
			}
		});
		socket.on("add_member",async(member_add)=>{
			let res_val=await socket_controller.add_member(member_add,room);
			if(res_val!=500){
				let result=new Object();
				result.friends_allow_to_room=res_val;
				io.to(room).emit("receive_data",result);
			}
		});
		socket.on("search_msg",(search_key)=>{
			console.log(search_key);
			let result;
			Message.find({ $and: [{$text: {$search: search_key}},{room: room}]},(err,messages)=>{
				if(err){
					console.log(err);
					console.log("error at search_msg");
					result=500;
				}
				else{
					result=messages;
					socket.emit("search_result",result);
				}
			});
		});
		socket.on("load_msg",async(msg_num)=>{
			let res_val=await socket_controller.load_msg(room,msg_num);
			socket.emit("receive_data",res_val);
		});
		socket.on("drop_out_room",async()=>{
			let result=await socket_controller.drop_out_room(room,name);
			lib.exit_msg(room,name);
			if(result===200){
				let res_val;
				await User.findOne({account: name},(err,user)=>{
					if(err){
						console.log("error at drop_out_room");
						res_val=500;
					}
					else if(!user){
						console.log("not found at drop_out_room");
						res_val=404;
					}
					else{
						res_val=user.rooms[0];
					}
				});
				if((res_val!=500)||(res_val!=404)){
					socket.emit("exit_room",res_val);
				}	
			}
		});
		socket.on("load_friend_create_room",()=>{
			User.findOne({account: name},async(err,user)=>{
				if(err){
					console.log("error at load_friend_create_room");
				}
				else if(!user){
					console.log("not found at load_friend_create_room");
				}
				else{
					let data=new Object();
					data.friends_allow_to_room=await socket_controller.friends_to_room(user.friends);
					socket.emit("receive_data",data);
				}
			});
		});
	});
}