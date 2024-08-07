import express from "express";
import http from "http";
import { Server } from "socket.io";
import logger from "./logger.js";
// import path from 'path'
// import { fileURLToPath } from 'url'

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500;
const ADMIN = "Admin";

const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Welcome rta!!!!" });
});

//app.use(express.static(path.join(__dirname, "public")))

// const expressServer = app.listen(PORT, () => {
//   logger.info(`listening on port ${PORT}`);
//  /// getPost("01A3380B-F8D9-4D00-9EB9-C78AAE1E0D14");
// });

const expressServer = app.listen(PORT);
logger.info(`Server running at http://127.0.0.1:${PORT}/`);
const updateSession = (empId) => {
  fetch(
    ` ${api_domian}${accounts_api_port}/api/user/UpdateLogout?EmployeeGuid=${empId}`
  )
    .then((response) => response.json())
    .then((data) => logger.info(data));
};

const updateRoomSession = (AgId) => {
  fetch(
    ` ${api_domian}${api_port}/api/Employee/LeaveRoomByAGid?EmployeeGuid=${AgId}`
  )
    .then((response) => response.json())
    .then((data) => logger.info(data));
};
const getData = (empId) => {
  const request = http.get(
    ` ${api_domian}${accounts_api_port}/api/user/UpdateLogout?EmployeeGuid=${empId}`,
    (response) => {
      // Set the encoding, so we don't get log to the console a bunch of gibberish binary data
      response.setEncoding("utf8");

      // As data starts streaming in, add each chunk to "data"
      response.on("data", (chunk) => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      response.on("end", () => {
        ~(data);
      });
    }
  );
};
// state

// Create the request body
const postData = JSON.stringify({
  title: "DDV",
  body: "Prasad",
  userId: 1,
});

const api_domian = "https://sutedevapi.thoughtcubeit.com";
const api_port = "/rest";
const accounts_api_port = "/auth";

const makePost = (empId) => {
  let data = "";
  const options = {
    hostname: ` ${api_domian}${accounts_api_port}`,
    path: ` ${api_domian}${accounts_api_port}/api/user/UpdateLogout?EmployeeGuid=${empId}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      //'Content-Length': Buffer.byteLength(postData),
    },
  };
  const request = http.request(options, (response) => {
    response.setEncoding("utf8");

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      console.log(data);
    });
  });

  request.on("error", (error) => {
    console.error(error);
  });

  // Write data to the request body
  request.write(postData);

  request.end();
};

const UsersState = {
  users: [],
  setUsers: function (newUsersArray) {
    this.users = newUsersArray;
  },
  calls: [],
  setCalls: function (newCallsArray) {
    this.calls = newCallsArray;
  },
};

const io = new Server(expressServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? false
        : ["http://localhost:3000", "http://127.0.0.1:300"],
  },
});

io.on("connection", (socket) => {
  logger.info(`User ${socket.id} connected`);

  // Upon connection - only to user
  ////socket.emit("message", buildMsg(ADMIN, "Welcome to Chat App!"));

  socket.on("enterRoom", ({ name, room }) => {
    logger.info(`enter Room ${room} user ${name}`);
    // leave previous room
    const prevRoom = getUser(socket.id)?.room;

    if (prevRoom) {
      socket.leave(prevRoom);
      io.to(prevRoom).emit(
        "message",
        buildMsg(ADMIN, `${name} has left the room`)
      );
    }

    const user = activateUser(socket.id, name, room);

    // Cannot update previous room users list until after the state update in activate user
    if (prevRoom) {
      io.to(prevRoom).emit("userList", {
        users: getUsersInRoom(prevRoom),
      });
    }

    // join room
    socket.join(user.room);

    // To user who joined
    // // socket.emit(
    // //   "message",
    // //   buildMsg(ADMIN, `You have joined the ${user.room} chat room`)
    // // );
    logger.info("Users", getUsersInRoom(user.room));

    // To everyone else
    socket.broadcast
      .to(user.room)
      .emit("message", buildMsg(ADMIN, `${user.name} has joined the room`));

    // Update user list for room
    io.to(user.room).emit("userList", {
      users: getUsersInRoom(user.room),
    });
   
    io.to(user.room).emit("userUpdated", user.room);
    io.to(user.id).emit("userUpdated", user.room);
    // Update rooms list for everyone
    io.emit("roomList", {
      rooms: getAllActiveRooms(),
    });
  });
  socket.on("groupUpdated", function () {
    console.log("groupUpdated",socket.id);
    const user = getUser(socket.id)
    if(user)
    io.to(user.room).emit("groupUpdated", user.room);
  });
  // When user disconnects - to all others
  socket.on("disconnect", () => {
    const user = getUser(socket.id);
    userLeavesApp(socket.id);
    userLeavesCall(socket.id);
    if (user) {
      logger.info(`User ${user.name} logout`);
      updateSession(user.name);

      // io.to(user.room).emit(
      //   "message",
      //   buildMsg(ADMIN, `${user.name} has left the room`)
      // );

      // io.to(user.room).emit("userList", {
      //   users: getUsersInRoom(user.room),
      // });
      io.to(user.room).emit("userUpdated", user.room);
      // io.emit("roomList", {
      //   rooms: getAllActiveRooms(),
      // });
    }

    logger.info(`User ${socket.id} disconnected`);
  });

  socket.on("forceDisconnect", function () {
    socket.disconnect(true);
  });
  // Listening for a message event
  socket.on("message", ({ name, text }) => {
    const room = getUser(socket.id)?.room;
    if (room) {
      io.to(room).emit("message", buildMsg(name, text));
    }
  });

  socket.on("userMessage", (UserId) => {
    logger.info("userMessage", UserId);
    const usrId = getUserID(UserId)?.id;
    logger.info("userMessage", usrId);
    if (usrId) {
      io.to(usrId).emit("userNewMessage", UserId);
    }
  });
  socket.on("GroupMessage", (UserId) => {
    logger.info("GroupMessage", UserId);
    const room = getUser(socket.id)?.room;
    logger.info("userMessage", room);
    if (room) {
      io.to(room).emit("userNewMessage", UserId);
    }
  });
  socket.on("checkUserCall", (UserId) => {
    logger.info("checkUserCall 1", UserId);
    const usrId = getUserID(UserId)?.id;
    logger.info("checkUserCall", usrId);
    if (usrId) {
      logger.info("ONLINE", UserId);
      socket.emit("userCallStatus", "ONLINE");
    } else {
      logger.info("OFFLINE", UserId);
      socket.emit("userCallStatus", "OFFLINE");
    }
  });
  socket.on("leaveUserCall", (callId) => {
    logger.info("leaveUserCall", callId);
    userLeavesCall(socket.id);
  });

  socket.on("popState", () => {
    logger.info("popState", socket.id);
    const Uid = getCallUser(socket.id)?.id;
    if (Uid && Uid.length > 0) {
      userLeavesCall(Uid);
      updateRoomSession(Uid.userID);
    }
    logger.info("Calls", UsersState.calls);
    // userLeavesCall(socket.id);
  });

  socket.on("roomCall", (UserId, callID) => {
    logger.info("roomCall", UserId);
    logger.info("Calls", UsersState.calls);

    //const Uid = getUserID(UserId)?.id;
    activateCall(socket.id, UserId, callID);
  });

  socket.on("roomLeave", (UserId) => {
    logger.info("roomLeave", UserId);
    const Uid = getCallUserID(UserId)?.id;
    userLeavesCall(Uid);
   // updateRoomSession(UserId);
    logger.info("Calls", UsersState.calls);
  });

  socket.on("userCall", (UserId, callID) => {
    logger.info("userCall", UserId);
    logger.info("Calls", UsersState.calls);
   // LeavesCall(callID);
    const inCall = UsersState.calls.filter((call) => call.userID == UserId);
    logger.info("inCall", inCall);
    if (inCall.length > 0) {
      logger.info("INCALL");
      socket.emit("userCallStatus", "INCALL");
    } else {
      const Uid = getUserID(UserId)?.id;
      logger.info("CALLING", Uid);
      io.to(Uid).emit("userCallStatus", "CALLING");
      activateCall(Uid, UserId, callID);
    }
  });

  socket.on("userCallStatus", (fromID, status) => {
    logger.info("userCallStatus", status);
    const usrId = getUserID(fromID)?.id;
    if (status == "ACCEPTED") {
      // const Uid = getUser(socket.id)?.name;
      //activateCall(socket.id, Uid, callID);

      io.to(usrId).emit("userCallStatus", "ACCEPTED");
    } else if (status == "REJECTED") {
      userLeavesCall(socket.id);
      io.to(usrId).emit("userCallStatus", "REJECTED");
    } else if (status == "CANCEL") {
      const otherCaller = UsersState.calls.filter((call) => call.callID == fromID && call.id != socket.id);
      if(otherCaller.length > 0) {
        logger.info("CANCEL", otherCaller[0]);
        io.to(otherCaller[0].id).emit("userCallStatus", "CANCELED");
        LeavesCall(fromID);
       // userLeavesCall(otherCaller[0].id);
      }else{
        logger.info("CANCEL NO user");
      }
      
     // userLeavesCall(socket.id);
      
    }
  });
  socket.on("callRequest", (UserId,reason) => {
    logger.info("callRequest", UserId);
    const usr = getUser(socket.id);
    if (reason == "TO_CALL") {
      io.to(usr.room).emit("userNewMessage", UserId);
    }
    if (usrId) {
      io.to(usrId).emit("userNewMessage", UserId);
    }
  });

  // Listen for activity
  socket.on("activity", (name) => {
    const room = getUser(socket.id)?.room;
    if (room) {
      socket.broadcast.to(room).emit("activity", name);
    }
  });
});

function buildMsg(name, text) {
  return {
    name,
    text,
    time: new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).format(new Date()),
  };
}

// User functions
function activateUser(id, name, room) {
  const user = { id, name, room };
  UsersState.setUsers([
    ...UsersState.users.filter((user) => user.id !== id),
    user,
  ]);
  return user;
}
function activateCall(id, userID, callID) {
  const callRoom = { id, userID, callID };
  UsersState.setCalls([
    ...UsersState.calls.filter((call) => call.id !== id),
    callRoom,
  ]);
  return callRoom;
}

function userLeavesApp(id) {
  UsersState.setUsers(UsersState.users.filter((user) => user.id !== id));
}
function userLeavesCall(id) {
  UsersState.setCalls(UsersState.calls.filter((user) => user.id !== id));
}
function LeavesCall(id) {
  UsersState.setCalls(UsersState.calls.filter((user) => user.callID != id));
  logger.info("Leaving call", UsersState.calls);
}
function getUser(id) {
  return UsersState.users.find((user) => user.id === id);
}

function getUsersInRoom(room) {
  return UsersState.users.filter((user) => user.room === room);
}

function getAllActiveRooms() {
  return Array.from(new Set(UsersState.users.map((user) => user.room)));
}

function getUserID(usr) {
  return UsersState.users.find((user) => user.name === usr);
}

function getCallUserID(usr) {
  return UsersState.calls.find((user) => user.userID === usr);
}
function getCallUser(ID) {
  return UsersState.calls.find((user) => user.id === ID);
}

function getCalls(room) {
  return UsersState.calls;
}
