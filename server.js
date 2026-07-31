const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");
const path=require("path");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
require("dotenv").config();
const User=require("./dbmodels/User");
const Event=require("./dbmodels/Event");
const Booking=require("./dbmodels/Booking");
const app=express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname,"models")));
app.get("/api/test",(req,res)=>{
res.status(200).json({success:true,message:"EventHub API Working"});
});
app.post("/api/users/register",async(req,res)=>{
try{
const{name,email,password,role}=req.body;
if(!name||!email||!password){
return res.status(400).json({success:false,message:"Name, email and password are required"});
}
const cleanEmail=email.trim().toLowerCase();
const existingUser=await User.findOne({email:cleanEmail});
if(existingUser){
return res.status(400).json({success:false,message:"User already registered"});
}
const hashedPassword=await bcrypt.hash(password,10);
const user=await User.create({
name:name.trim(),
email:cleanEmail,
password:hashedPassword,
role:["user","organizer","admin"].includes(role)?role:"user"
});
return res.status(201).json({
success:true,
message:"Registration successful",
user:{
id:user._id.toString(),
_id:user._id.toString(),
name:user.name,
email:user.email,
role:user.role||"user"
}
});
}catch(error){
console.error("REGISTER ERROR:",error);
return res.status(500).json({success:false,message:"Registration failed",error:error.message});
}
});
app.post("/api/users/login",async(req,res)=>{
try{
const{email,password}=req.body;
if(!email||!password){
return res.status(400).json({success:false,message:"Email and password are required"});
}
const cleanEmail=email.trim().toLowerCase();
const user=await User.findOne({email:cleanEmail});
if(!user){
return res.status(401).json({success:false,message:"Invalid email or password"});
}
const passwordMatch=await bcrypt.compare(password,user.password);
if(!passwordMatch){
return res.status(401).json({success:false,message:"Invalid email or password"});
}
const role=user.role||"user";
const token=jwt.sign({
id:user._id.toString(),
email:user.email,
role:role
},process.env.JWT_SECRET||"EventHub2026SecureSecret",{expiresIn:"1d"});
return res.status(200).json({
success:true,
message:"Login successful",
token:token,
user:{
id:user._id.toString(),
_id:user._id.toString(),
name:user.name,
email:user.email,
role:role
}
});
}catch(error){
console.error("LOGIN ERROR:",error);
return res.status(500).json({success:false,message:"Login failed",error:error.message});
}
});
app.get("/api/events",async(req,res)=>{
try{
const events=await Event.find({}).sort({date:1});
return res.status(200).json(events);
}catch(error){
console.error("GET EVENTS ERROR:",error);
return res.status(500).json({success:false,message:"Unable to load events",error:error.message});
}
});
app.post("/api/events",async(req,res)=>{
try{
const{title,venue,date,price,seats,description}=req.body;
if(!title||!venue||!date||price===undefined||seats===undefined){
return res.status(400).json({success:false,message:"All event details are required"});
}
const eventPrice=Number(price);
const eventSeats=Number(seats);
if(!Number.isFinite(eventPrice)||eventPrice<0){
return res.status(400).json({success:false,message:"Invalid event price"});
}
if(!Number.isInteger(eventSeats)||eventSeats<0){
return res.status(400).json({success:false,message:"Invalid seat count"});
}
const event=await Event.create({
title:title.trim(),
venue:venue.trim(),
date:date,
price:eventPrice,
seats:eventSeats,
description:description||""
});
return res.status(201).json({success:true,message:"Event created successfully",event:event});
}catch(error){
console.error("CREATE EVENT ERROR:",error);
return res.status(500).json({success:false,message:"Unable to create event",error:error.message});
}
});
app.put("/api/events/:id",async(req,res)=>{
try{
if(!mongoose.Types.ObjectId.isValid(req.params.id)){
return res.status(400).json({success:false,message:"Invalid event ID"});
}
const event=await Event.findById(req.params.id);
if(!event){
return res.status(404).json({success:false,message:"Event not found"});
}
const{title,venue,date,price,seats,description}=req.body;
if(title!==undefined)event.title=title;
if(venue!==undefined)event.venue=venue;
if(date!==undefined)event.date=date;
if(price!==undefined)event.price=Number(price);
if(seats!==undefined)event.seats=Number(seats);
if(description!==undefined)event.description=description;
await event.save();
return res.status(200).json({success:true,message:"Event updated successfully",event:event});
}catch(error){
console.error("UPDATE EVENT ERROR:",error);
return res.status(500).json({success:false,message:"Unable to update event",error:error.message});
}
});
app.delete("/api/events/:id",async(req,res)=>{
try{
if(!mongoose.Types.ObjectId.isValid(req.params.id)){
return res.status(400).json({success:false,message:"Invalid event ID"});
}
const event=await Event.findByIdAndDelete(req.params.id);
if(!event){
return res.status(404).json({success:false,message:"Event not found"});
}
return res.status(200).json({success:true,message:"Event deleted successfully"});
}catch(error){
console.error("DELETE EVENT ERROR:",error);
return res.status(500).json({success:false,message:"Unable to delete event",error:error.message});
}
});
app.post("/api/bookings",async(req,res)=>{
try{
const{userId,eventId,tickets}=req.body;
const ticketCount=Number(tickets);
if(!userId){
return res.status(400).json({success:false,message:"User ID missing"});
}
if(!eventId){
return res.status(400).json({success:false,message:"Event ID missing"});
}
if(!mongoose.Types.ObjectId.isValid(userId)){
return res.status(400).json({success:false,message:"Invalid user ID"});
}
if(!mongoose.Types.ObjectId.isValid(eventId)){
return res.status(400).json({success:false,message:"Invalid event ID"});
}
if(!Number.isInteger(ticketCount)||ticketCount<1){
return res.status(400).json({success:false,message:"Invalid ticket quantity"});
}
const user=await User.findById(userId);
if(!user){
return res.status(404).json({success:false,message:"User not found"});
}
const event=await Event.findById(eventId);
if(!event){
return res.status(404).json({success:false,message:"Event not found"});
}
if(Number(event.seats)<ticketCount){
return res.status(400).json({success:false,message:"Not enough seats available"});
}
const totalPrice=Number(event.price)*ticketCount;
const ticketNumber="EVT-"+Date.now()+"-"+Math.floor(1000+Math.random()*9000);
const booking=await Booking.create({
user:user._id,
event:event._id,
tickets:ticketCount,
totalPrice:totalPrice,
ticketNumber:ticketNumber
});
event.seats=Number(event.seats)-ticketCount;
await event.save();
const result=await Booking.findById(booking._id).populate("user","name email").populate("event");
return res.status(201).json({
success:true,
message:"Booking successful",
booking:result
});
}catch(error){
console.error("BOOKING ERROR:",error);
return res.status(500).json({success:false,message:"Booking failed",error:error.message});
}
});
app.get("/api/bookings",async(req,res)=>{
try{
const bookings=await Booking.find({})
.populate("user","name email")
.populate("event")
.sort({createdAt:-1});
return res.status(200).json(bookings);
}catch(error){
console.error("GET BOOKINGS ERROR:",error);
return res.status(500).json({success:false,message:"Unable to load bookings",error:error.message});
}
});
app.get("/api/bookings/my/:userId",async(req,res)=>{
try{
const userId=req.params.userId;
if(!mongoose.Types.ObjectId.isValid(userId)){
return res.status(400).json({success:false,message:"Invalid user ID"});
}
const bookings=await Booking.find({user:userId})
.populate("event")
.populate("user","name email")
.sort({createdAt:-1});
return res.status(200).json(bookings);
}catch(error){
console.error("MY BOOKINGS ERROR:",error);
return res.status(500).json({success:false,message:"Unable to load bookings",error:error.message});
}
});
app.delete("/api/bookings/:id",async(req,res)=>{
try{
if(!mongoose.Types.ObjectId.isValid(req.params.id)){
return res.status(400).json({success:false,message:"Invalid booking ID"});
}
const booking=await Booking.findById(req.params.id);
if(!booking){
return res.status(404).json({success:false,message:"Booking not found"});
}
const event=await Event.findById(booking.event);
if(event){
event.seats=Number(event.seats)+Number(booking.tickets);
await event.save();
}
await Booking.findByIdAndDelete(req.params.id);
return res.status(200).json({success:true,message:"Booking cancelled successfully"});
}catch(error){
console.error("CANCEL BOOKING ERROR:",error);
return res.status(500).json({success:false,message:"Unable to cancel booking",error:error.message});
}
});
app.get("/",(req,res)=>{
res.sendFile(path.join(__dirname,"models","index.html"));
});
app.use((req,res)=>{
if(req.path.startsWith("/api/")){
return res.status(404).json({success:false,message:"API route not found"});
}
return res.status(404).send("Page not found");
});
const PORT=process.env.PORT||5000;
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
console.log("MongoDB Connected");
app.listen(PORT,()=>{
console.log("EventHub Server Started");
console.log("Server running on port "+PORT);
});
})
.catch(error=>{
console.error("MongoDB Connection Error:",error);
});