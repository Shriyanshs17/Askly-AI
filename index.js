import express from "express";
import ImageKit from "imagekit";
import cors from "cors";
import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node'
import mongoose from "mongoose";
import Chat from "./models/chats.js";
import UserChats from "./models/userChats.js"
// import path from "path";
// import url, { fileURLToPath } from "url";
const port =process.env.PORT || 3000;
const app=express();

// const __filename=fileURLToPath(import.meta.url);
// const __dirname=pathdirname(__filename);

app.use(cors({
    origin:true,
    credentials:true
    
}));

app.use(express.json());

const connect=async ()=>
{
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Connected to DB");
    } catch (error) {
        console.log(error);       
    }
}

const imagekit = new ImageKit({
    urlEndpoint: process.env.IMAGE_KIT_ENDPOINT,
    publicKey:process.env.IMAGE_KIT_PUBLIC_KEY,
    privateKey: process.env.IMAGE_KIT_PRIVATE_KEY
  });

app.get("/api/upload",(req,res)=>
{
    const result = imagekit.getAuthenticationParameters();
    res.send(result);
});

// create a chat
app.post("/api/chats",ClerkExpressRequireAuth(),async (req,res)=>
{
    const userId=req.auth.userId;
    const {text}=req.body;
    try {
        // create a new chat
        const newChat=new Chat({
            userId:userId,
            history:[{role:"user",parts:[{text}]}]
        });

        const saveChat=await newChat.save(); 

        // check if the userchats exists
        const userChats=await UserChats.find({userId:userId});

        // if doesn't exist create a new one and add the chat in the chats array
        if(!userChats.length)
        {
            const newUserChats=new UserChats({
                userId:userId,
                chats:[
                    {
                        _id:saveChat.id,
                        title: text.substring(0,40),        
                    },
                ]
            })
            
            // console.log(newUserChats);
            await newUserChats.save();
        }
        else{
            // if exists, push the chaat to the axisting array
            await UserChats.updateOne({userId:userId},{
                $push:{
                 chats:{
                    _id:saveChat._id,
                    title:text.substring(0,40)
                 }
            }})
        }

        res.status(201).send(newChat._id);

    } catch (error) {
        console.log(error);
        res.status(500).send("Error creating chat!");
    }
    
});

app.get("/api/userchats",ClerkExpressRequireAuth(),async(req,res)=>
{
    const userId=req.auth.userId;
    try {
        const userChats=await UserChats.find({userId});

        res.status(200).send(userChats[0].chats);
    } catch (error) {
        console.log(error);
        res.status(500).send("Error fetching userchats");
        
    }
})

app.get("/api/chats/:id",ClerkExpressRequireAuth(),async(req,res)=>
{
    const userId=req.auth.userId;
    try {
        const chat=await Chat.findOne({_id:req.params.id,userId});

        res.status(200).send(chat);
    } catch (error) {
        console.log(error);
        res.status(500).send("Error fetching userchats");
        
    }
})


app.put("/api/chats/:id", ClerkExpressRequireAuth(), async (req, res) => {
    const userId = req.auth.userId;
  
    const { question, answer, img } = req.body;
  
    const newItems = [
      ...(question
        ? [{ role: "user", parts: [{ text: question }], ...(img && { img }) }]
        : []),
      { role: "model", parts: [{ text: answer }] },
    ];
  
    try {
      const updatedChat = await Chat.updateOne(
        { _id: req.params.id, userId },
        {
          $push: {
            history: {
              $each: newItems,
            },
          },
        }
      );
      res.status(200).send(updatedChat);
    } catch (err) {
      console.log(err);
      res.status(500).send("Error adding conversation!");
    }
  });


// error handler for clerk authentication
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(401).send('Unauthenticated!')
  });

  // app.use(express.static(apth.join(__dirname,"../frontend")));

  // app.get("*",(req,res)=>{
  //   res.sendFile(path.join(__dirname,"../frontend","index.html"));
  // })

app.listen(port,()=>{
    connect();
    console.log(`Server running on ${port}`);
    
})