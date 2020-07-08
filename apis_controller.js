var User=require('./db/model_user');
var Message=require('./db/model_message');
var Room=require('./db/model_room');
var User_Attr=require('./db/model_user_attr');
var lib=require("./db/lib");

exports.login=async(name,password)=>{
	let result;
	if((!name)||(!password)){
		console.log("name or password empty at login");
		result=204;
	}
	let pwd= await lib.create_crypto(password,"jizz7122");
	await User.findOne({account: name},(err,user)=>{
		if(err){
			console.log("err at login");
			result=500;
		}
		else if(!user){
			console.log("user not exists at login");
			result=404;
		}
		else if(user.pwd!=pwd){
			console.log("password not correct");
			result=406;
		}
		else{
			result=200;
		}
	});
	return result;
}

var create_user=async(name,pwd,num)=>{
	let new_user=new User({
		account: name,
		pwd: pwd,
		rooms: [num],
		friends: [name],
		allow_add_friend: true
	});
	await new_user.save((err)=>{
		if(err){
			console.log("can't save new_user at create_user");
		}
	});
	let new_user_attr=new User_Attr({
		account: name,
		allow_to_room: true
	});
	await new_user_attr.save((err)=>{
		if(err){
			console.log("can't save new_user_attr at create_user");
		}
	});
}

exports.register=async(name,password,password_auth)=>{
	let result;
	if((!name)||(!password)||(!password_auth)){
		console.log("blank empty at register");
		result=204;
	}
	if(password_auth!=password){
		console.log("password confirm fail at register");
		result=406;
	}
	let pwd=await lib.create_crypto(password,"jizz7122");
	await User.findOne({account: name},async(err,user)=>{
		if(err){
			console.log("err at register");
			result=500;
		}
		if(user){
			console.log("user exists at register");
			result=302;
		}
		else{
			let num=await lib.createroom([name]);
			await create_user(name,pwd,num);
			result=200;
		}
	});
	return result;
}


exports.redirect_chat=async(name)=>{
	let room;
	await User.findOne({account: name},(err,user)=>{
		if(err){
			console.log("error at redirect_chat");
			room=500;
		}
		else if(!user){
			console.log("not found at redirect_chat");
			room=404;
		}
		else{
			room=user.rooms[0];
		}
	});
	return room;
}


exports.chpwd=async(name,old_pwd,new_pwd,new_pwd_again)=>{
	let result=200;
	if(new_pwd!=new_pwd_again){
		console.log("new pwd not equal at chpwd");
		result=406;
	}
	else{
		await User.findOne({account: name},async(err,user)=>{
			if(err){
				console.log("error at chpwd");
				result=500;
			}
			else if(!user){
				console.log("not found at chpwd");
				result=404;
			}
			else{	
				let pwd=await lib.create_crypto(old_pwd,"jizz7122");
				if(user.pwd!=pwd){
					console.log("old_pwd not correct at chpwd");
					result=406;
				}
				else{
					let new_password=await lib.create_crypto(new_pwd,"jizz7122");
					await User.updateOne({account: name},{$set: {pwd: new_password}},(err)=>{
						if(err){
							console.log("error update pwd at chpwd");
						}
					});
					result=200;
				} 
			}
		});
	}
	return result;
}