const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Yes, TLS is required
const serverConfig = {
   key: fs.readFileSync('key.pem'),
   cert: fs.readFileSync('cert.pem'),
};

//all connected to the server users 
var users = {};
var allUsers = [];
var user_status = {};
// ----------------------------------------------------------------------------------------

// Create a server for the client html page
const handleRequest = function(request, response) {
  // Render the single client html file for any request the HTTP server receives
   console.log('request received: ' + request.url);

   if(request.url === '/') {
      response.writeHead(200, {'Content-Type': 'text/html'});
      response.end(fs.readFileSync('client/index.html'));
  } else if(request.url === '/webrtc.js') {
      response.writeHead(200, {'Content-Type': 'application/javascript'});
      response.end(fs.readFileSync('client/webrtc.js'));
  }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a server for handling websocket calls
const wss = new WebSocketServer({server: httpsServer});



wss.on('connection', function(ws) {
   ws.on('message', function(message) {

      var data;
		
    //accepting only JSON messages 
      try { 
         data = JSON.parse(message); 
      } catch (e) { 
         console.log("Invalid JSON"); 
         data = {}; 
      }
    
      console.log('received data:', data);
     //switching type of the user message 
      switch (data.type) { 
      //when a user tries to login 
         case "login": 
            console.log("User logged", data.name); 
     
            console.log('if anyone is logged in with this username then refuse') 
            if(users[data.name]) { 
               sendTo(ws, { 
                  type: "login", 
                  success: false 
               }); 
            } else { 
               console.log('save user connection on the server') 
               users[data.name] = ws; 
               allUsers.indexOf(data.name) === -1 ? allUsers.push(data.name) : console.log("This item already exists");
               
               user_status[data.name] = true;
               //console.log('all available users',JSON.stringify(users))
               ws.name = data.name;
       
               sendTo(ws, { 
                  type: "login", 
                  success: true, 
                  allUsers:allUsers
               });

               for(var user in users){
                  var conn = users[user];
                  sendTo(conn, {
                     type: "joined",
                     allUsers:allUsers
                  });
               }

               changeUserStatus(data.name, "free");
               notifyUsers();
            } 
     
         break;
         
         case "snap":
            console.log("remote snap img url: ", data.snapUrl.substring(0, 32));

            var conn = users[data.name];

            if(conn != null) {
               ws.otherName = data.name; 
       
               sendTo(conn, { 
                  type: "snap", 
                  snapUrl: data.snapUrl 
               }); 
            }
         break;

         case "offer": 
            //for ex. UserA wants to call UserB 
            console.log("Sending offer to: ", data.name); 
     
            //if UserB exists then send him offer details 
            var conn = users[data.name]; 
     
            if(conn != null) { 
               //setting that UserA connected with UserB 
               ws.otherName = data.name; 
       
               sendTo(conn, { 
                  type: "offer", 
                  offer: data.offer, 
                  name: ws.name
               }); 

               changeUserStatus(data.reqFrom, "oncall");
               changeUserStatus(data.name, "oncall");
               notifyUsers();
            } 
     
         break;
     
         case "answer": 
            console.log("Sending answer to: ", data.name); 
            //for ex. UserB answers UserA 
            var conn = users[data.name]; 
            console.log('answer: ',data.answer)
      
            if(conn != null) { 
               ws.otherName = data.name; 
               sendTo(conn, { 
                  type: "answer", 
                  answer: data.answer 
               });
            } 
      
         break;
     
         case "candidate": 
            console.log("Sending candidate to:",data.name); 
            var conn = users[data.name];  
      
            if(conn != null) { 
               sendTo(conn, { 
                  type: "candidate", 
                  candidate: data.candidate 
               }); 
            } 
      
         break;
     
         case "leave": 
            console.log("Disconnecting from", data.name); 
            var conn = users[data.name]; 
            //conn.otherName = null; 
      
            //notify the other user so he can disconnect his peer connection 
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave" 
               });

               changeUserStatus(data.reqFrom, "free");
               changeUserStatus(data.name, "free");
               notifyUsers();
            }  
      
         break;

         case "timeout":
            console.log("call timeout");
            var conn = users[data.name]; 
            //conn.otherName = null; 
      
            if(conn != null) { 
               sendTo(conn, { 
                  type: "timeout",
                  name: ws.name 
               });

               changeUserStatus(data.reqFrom, "free");
               changeUserStatus(data.name, "free");
               notifyUsers();
            }  
         break;

         case "decline":
            console.log("Decline from", data.name); 
            var conn = users[data.name]; 
            //conn.otherName = null; 
      
            //notify the other user so he can disconnect his peer connection 
            if(conn != null) { 
               sendTo(conn, { 
                  type: "decline" 
               });

               changeUserStatus(data.reqFrom, "free");
               changeUserStatus(data.name, "free");
               notifyUsers();
            }  
         break;

         case "close":
            console.log("close from ", data.reqFrom);

            delete user_status[data.reqFrom];
            delete allUsers[data.reqFrom];
            notifyUsers();
         break;
     
         default: 
            sendTo(ws, { 
               type: "error", 
               message: "Command not found: " + data.type 
            });
      
         break; 
      }  
    //wss.broadcast(message);
   });

   
   ws.on("close", function() { 
      if(ws.name) { 
         delete users[ws.name]; 
    
         if(ws.otherName) { 
            console.log("Disconnecting from ", ws.otherName); 
            var conn = users[ws.otherName]; 
            conn.otherName = null;  
         
            if(conn != null) { 
               sendTo(conn, { 
                  type: "leave"
               }); 
            }  
         } 
      } 
   }); 
   

   //ws.send("Hello world"); 
});

function sendTo(connection, message) { 
  connection.send(JSON.stringify(message)); 
}
// wss.broadcast = function(data) {
//   this.clients.forEach(function(client) {
//     if(client.readyState === WebSocket.OPEN) {
//       client.send(data);
//     }
//   });
// };

function changeUserStatus(tar, act) {
   switch (act) {
      case "oncall":
         user_status[tar] = false;
      break;
      
      case "free":
         user_status[tar] = true;
      break;
   }
}

function notifyUsers() {
   for(var user in users){
      var conn = users[user];
      sendTo(conn, {
         type: "statusChange",
         user_status:user_status
      });
   }
}

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);
