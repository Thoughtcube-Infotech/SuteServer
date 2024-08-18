import express from "express";
import { Server } from "socket.io";
import logger from "./logger.js";

const PORT = process.env.PORT || 3500;
const ADMIN = "Admin";
const api_domian = "https://sutedevapi.thoughtcubeit.com";
const api_port = "/rest";
const accounts_api_port = "/auth";

const updateSession = (empId) => {
  logger.info(`updateSession ${empId}`);
  fetch(
    ` ${api_domian}${accounts_api_port}/api/user/UpdateLogout?EmployeeGuid=${empId}`
  )
    .then((response) => response.json())
    .then((data) => logger.info(`updateSession ${data}`));
};

const updateRoomSession = (AgId) => {
  logger.info(`updateRoomSession ${AgId}`);  
  fetch(`${api_domian}${api_port}/api/Employee/LeaveRoomByAGid?AgId=${AgId}`)
    .then((response) => response.json())
    .then((data) => logger.info(`updateRoomSession ${data}`));
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
``;
const app = express();

app.get("/", (req, res) => {
  res.json({ message: "Welcome rta!!!!" });
});

const expressServer = app.listen(PORT);
logger.info(`Server running at http://127.0.0.1:${PORT}/`);

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

  socket.on("enterRoom", ({ empGuid, name, room }) => {
    logger.info(`enter Room ${room} ID ${empGuid} user ${name}`);

    const user = activateUser(socket.id, empGuid, name, room);

    // join room
    socket.join(user.room);

    logger.info("Users ");
    logger.info(getUsersInRoom(user.room));

    // // To everyone else
    // socket.broadcast
    //   .to(user.room)
    //   .emit("message", buildMsg(ADMIN, `${user.name} has joined the room`));

    io.to(user.room).emit("userUpdated", user.room);
    // io.to(user.id).emit("userUpdated", user.room);
    // Update rooms list for everyone
    // io.emit("roomList", {
    //   rooms: getAllActiveRooms(),
    // });
  });

  socket.on("groupUpdated", function () {
    logger.info("groupUpdated " + socket.id);
    const user = getUser(socket.id);
    if (user) {
      logger.info("groupUpdated room " + user.room);
      io.to(user.room).emit("groupUpdated", user.room);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`disconnect ${socket.id}`);

    const callers = getCallUser(socket.id);
    logger.info(`disconnect callers `, callers);
    logger.info(`disconnect callers length `, typeof callers);

    if (callers) {
      logger.info(`disconnect up call sess ${callers.Sid}`);
      userLeavesCall(socket.id);
      updateRoomSession(callers.agID);
    }

    const user = getUser(socket.id);
    userLeavesApp(socket.id);

    if (user) {
      logger.info(`User ${user.name} - ${user.UserGuid} logout`);
      updateSession(user.UserGuid);

      io.to(user.room).emit("userUpdated", user.room);
    }

    logger.info(`User ${socket.id} disconnected`);
  });

  socket.on("forceDisconnect", function () {
    socket.disconnect(true);
  });

  socket.on("popState", () => {
    logger.info(`popState ${socket.id}`);
    const callers = getCallUser(socket.id);
    if (callers && callers.length > 0) {
      logger.info(`popState up call sess ${callers[0].UserGuid}`);
      userLeavesCall(socket.id);
      updateRoomSession(callers[0].UserGuid);
    }
    logger.info("Calls ");
    logger.info(UsersState.calls);
  });

  /// Messages

  socket.on("userMessage", (UserId) => {
    logger.info(`userMessage ${UserId}`);
    const usrSid = getUserID(UserId)?.Sid;
    logger.info(`userMessage ${usrSid}`);
    if (usrSid) {
      io.to(usrSid).emit("userNewMessage", UserId);
    }
  });

  socket.on("GroupMessage", (UserId) => {
    logger.info(`GroupMessage ${UserId}`);
    const room = getUser(socket.id)?.room;
    logger.info(`userMessage ${room}`);
    if (room) {
      io.to(room).emit("userNewMessage", UserId);
    }
  });

  /// calls

  socket.on("roomCall", (UUid, callID, UserGUID) => {
    logger.info("roomCall " + UUid);
    logger.info("Calls ");
    logger.info(UsersState.calls);

    //const Uid = getUserID(UserId)?.id;
    activateCall(socket.id, UserGUID, callID, UUid);
  });

  socket.on("roomLeave", (UserId) => {
    logger.info("roomLeave " + UserId);
    const Sid = getCallByUserID(UserId)?.id;
    userLeavesCall(Sid);
    // updateRoomSession(UserId);
    logger.info("Calls ");
    logger.info(UsersState.calls);
  });

  /// 1 to 1 call

  socket.on("checkUserCall", (UserId) => {
    logger.info("checkUserCall 1 " + UserId);
    const usrSId = getUserID(UserId)?.Sid;
    logger.info("checkUserCall " + usrSId);
    if (usrSId) {
      logger.info("checkUserCall has user" + UserId);
      const inCall = UsersState.calls.filter(
        (call) => call.UserGuid == UserId || call.agID == UserId
      );
      logger.info("inCall ");
      logger.info(inCall);
      if (inCall.length > 0) {
        logger.info("INCALL");
        io.to(socket.id).emit("userfromCallStatus", "INCALL");
      } else {
        logger.info("checkUserCall user ONLINE");
        io.to(socket.id).emit("userfromCallStatus", "ONLINE");
      }
      //io.to(socket.id).emit("userfromCallStatus", "ONLINE");
    } else {
      logger.info("OFFLINE", UserId);
      io.to(socket.id).emit("userfromCallStatus", "OFFLINE");
    }
  });

  socket.on("userCall", (UserId, callID) => {
    logger.info("userCall " + UserId);
    logger.info("Calls ");
    logger.info(UsersState.calls);

    const ToSid = getUserID(UserId)?.Sid;
    logger.info("CALLING " + ToSid);
    io.to(ToSid).emit("userCallStatus", "CALLING");

    const fromUserGuid = getUser(socket.id)?.UserGuid;
    activateCall(socket.id, fromUserGuid, callID, "OOOO");
    activateCall(ToSid, UserId, callID, "OOOO");
  });

  socket.on("userCallStatus", (fromID, status) => {
    logger.info("userCallStatus " + status);

    const usrId = getUserID(fromID)?.Sid;
    if (status == "ACCEPTED") {
      io.to(usrId).emit("userfromCallStatus", "ACCEPTED");
    } else if (status == "REJECTED") {
      userLeavesCall(socket.id);
      io.to(usrId).emit("userfromCallStatus", "REJECTED");
    } else if (status == "ENDED") {
      if (usrId) {
        logger.info(" userCallStatus ENDED  " + usrId);
        const caller = getCallUser(usrId);
        logger.info(" userCallStatus ENDED caller ");
        logger.info(caller);

        if (caller) {
          io.to(usrId).emit("userfromCallStatus", "ENDED");
          LeavesCall(caller.callID);
        }
      }
    } else if (status == "CANCEL") {
      const otherCaller = UsersState.calls.filter(
        (call) => call.callID == fromID && call.Sid != socket.id
      );
      if (otherCaller.length > 0) {
        logger.info(" userCallStatus CANCEL " + otherCaller[0]);
        io.to(otherCaller[0].Sid).emit("userCallStatus", "CANCELED");
        LeavesCall(otherCaller[0].callID);
        // userLeavesCall(otherCaller[0].id);
      } else {
        logger.info("userCallStatus CANCEL NO user");
      }
    }
  });

  socket.on("userfromCallStatus", (fromID, status) => {
    logger.info("userfromCallStatus " + status + " " + fromID);
    const usrId = getUserID(fromID)?.Sid;
    if (status == "ACCEPTED") {
      io.to(usrId).emit("userCallStatus", "ACCEPTED");
    } else if (status == "REJECTED") {
      userLeavesCall(socket.id);
      io.to(usrId).emit("userCallStatus", "REJECTED");
    } else if (status == "CANCEL") {
      const otherCaller = UsersState.calls.filter(
        (call) => call.callID == fromID && call.Sid != socket.id
      );
      if (otherCaller.length > 0) {
        logger.info("userfromCallStatus CANCEL ");
        logger.info(otherCaller[0]);
        io.to(otherCaller[0].Sid).emit("userCallStatus", "CANCELED");
        LeavesCall(fromID);
        // userLeavesCall(otherCaller[0].id);
      }
    } else if (status == "ENDED") {
      logger.info("userfromCallStatus in " + status + " " + fromID);

      const otherCaller = UsersState.calls.filter(
        (call) => call.callID == fromID && call.Sid != socket.id
      );
      if (otherCaller.length > 0) {
        logger.info("userfromCallStatus ENDED ");
        logger.info(otherCaller[0]);
        io.to(otherCaller[0].Sid).emit("userCallStatus", "ENDED");
        LeavesCall(fromID);
      }
    } else {
      logger.info("userfromCallStatus CANCEL NO user");
    }

    // userLeavesCall(socket.id);
  });

  socket.on("leaveUserCall", (callId) => {
    logger.info("leaveUserCall " + callId);
    LeavesCall(callId);
  });
});

function activateUser(Sid, UserGuid, name, room) {
  const user = { Sid, UserGuid, name, room };
  UsersState.setUsers([
    ...UsersState.users.filter((user) => user.Sid !== Sid),
    user,
  ]);
  return user;
}

function activateCall(Sid, UserGuid, callID, agID) {
  const callRoom = { Sid, UserGuid, callID, agID };
  UsersState.setCalls([
    ...UsersState.calls.filter((call) => call.Sid !== Sid),
    callRoom,
  ]);
  logger.info("activateCall ");
  logger.info(UsersState.calls);

  return callRoom;
}

function getUsersInRoom(room) {
  return UsersState.users.filter((user) => user.room === room);
}

function getUser(id) {
  return UsersState.users.find((user) => user.Sid === id);
}

function getCallUser(id) {
  return UsersState.calls.find((user) => user.Sid === id);
}

function getUserID(UserID) {
  return UsersState.users.find((user) => user.UserGuid === UserID);
}

function getCallByUserID(usrId) {
  return UsersState.calls.find((user) => user.UserGuid === usrId);
}

function userLeavesApp(id) {
  UsersState.setUsers(UsersState.users.filter((user) => user.Sid !== id));
}

function userLeavesCall(id) {
  UsersState.setCalls(UsersState.calls.filter((user) => user.Sid !== id));
}

function LeavesCall(Callid) {
  UsersState.setCalls(UsersState.calls.filter((user) => user.callID != Callid));
  logger.info("LeavesCall");
  logger.info(UsersState.calls);
}
