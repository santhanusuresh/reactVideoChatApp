import React, { useEffect, useState } from 'react';
import './App.css';
import getUserMedia from 'getusermedia';
import simplePeer from 'simple-peer';
import io from "socket.io-client";

const App = (props) => {

  const ENDPOINT = 'http://localhost:5001/';
  const bookingId = window.location.pathname === `/fan1` ? `12345` : window.location.pathname === `/fan2` ? `1234` : `123`;
  const socket = io(ENDPOINT);
  const [peer, setPeer] = useState(new simplePeer({ initiator: false, trickle: false, stream: null })); // just create empty object
  const [peer1, setPeer1] = useState(new simplePeer({ initiator: false, trickle: false, stream: null })); // just create empty object
  // const [chatReqfrom, setChatReqfrom] = useState(``);
  const [chatWith, setChatWith] = useState(``);

  console.log("props", props, window.location.pathname === `/fan`);

  let fromUser = ``;
  peer.on('signal', data => {
    console.log("peer.on(signal", fromUser, data);
    if (fromUser) {
      socket.emit('video-chat-accepted', { data, to: fromUser, from: bookingId }); // to: 123, from: 12345
    } else {
      socket.emit('video-chat-offer', { data, to: chatWith, from: bookingId }); // to: 12345, from: 123
    }
  })

  useEffect(() => { }, [])

  socket.on(`video-chat-accept${bookingId}`, ({ data, from = `` }) => {
    let isVideoChatEstablished = chatWith === from;
    console.log(" video-chat-accept", bookingId, data, from, isVideoChatEstablished);
    console.log(" video-chat-accept from", from);
    fromUser = fromUser ? fromUser : from;
    //alert(`accept video chat offer`)
    if (fromUser) {
      setPeer(prev => { prev.signal(data); return prev })
    } else {
      peer.signal(data);
    }

  });

  useEffect(() => {
    if (!chatWith) return;
    socket.emit('join', { bookingId: chatWith }, () => { });
    let stream;
    getUserMedia({ video: false, audio: true }, function (err, stream) {
      if (err) return console.error(err)
      stream = stream;
      setPeer(new simplePeer({ initiator: true, trickle: false, stream: stream }));
      const video = document.getElementById('localVideo')//document.createElement('video')
      // video.muted = false;
      video.srcObject = new MediaStream(stream);
      const promise = video.play()
      if (promise !== undefined) {
        promise.then(_ => {
          console.log("Autoplay started!");
        }).catch(error => {
          console.log("Autoplay was prevented.", error);
          // Show a "Play" button so that user can start playback.
        });
      }
    })
    return () => {
      peer.destroy([`user left`])
    }
  }, [chatWith])

  socket.on(`joined`, ({ user, users = [] }) => {
    console.log("YOU joined", user, users);
  });

  socket.on(`joinwith${bookingId}`, ({ user, users = [] }) => {
    console.log(`joinwith-${bookingId}`, user, users);
    socket.emit('join', { bookingId, isClientJoined: true }, () => { });
  });

  socket.on(`both-joined`, ({ user, users = [] }) => {
    console.log(" both-joined", user, users);
  });

  socket.on(`message${bookingId}`, ({ data, from = `` }) => {
    console.log(" message", data, from);
    document.getElementById('messages').textContent += data + '\n'
  });

  socket.on('error', (error) => {
    console.log("socket error", error);
  });

  peer.on('error', (err) => {
    console.log("socket error", err);
  })

  const sendMessage = () => {
    console.log("sendMessage");
    if (fromUser) {
      socket.emit('replyMessage', { data: document.getElementById('yourMessage').value, to: fromUser, from: bookingId }, () => { });
    } else {
      socket.emit('sendMessage', { data: document.getElementById('yourMessage').value, to: chatWith, from: bookingId }, () => { });
    }
  }

  peer.on('stream', function (stream) {
    console.log(" peer.on('stream', function (stream) {", stream);
    const video = document.getElementById('remoteVideo')//document.createElement('video')
    // video.muted = false;
    video.srcObject = new MediaStream(stream);
    const promise = video.play()
    if (promise !== undefined) {
      promise.then(_ => {
        console.log("Autoplay started!");
      }).catch(error => {
        console.log("Autoplay was prevented.", error);
        // Show a "Play" button so that user can start playback.
      });
    }
    getUserMedia({ video: false, audio: true }, function (err, stream) {
      if (err) return console.error(err)
      const video = document.getElementById('localVideo')//document.createElement('video')
      // video.muted = false;
      video.srcObject = new MediaStream(stream);
      const promise = video.play()
      if (promise !== undefined) {
        promise.then(_ => {
          console.log("Autoplay started!");
        }).catch(error => {
          console.log("Autoplay was prevented.", error);
          // Show a "Play" button so that user can start playback.
        });
      }
      console.log("sendStream", new simplePeer({ initiator: true, trickle: false, stream: stream }), stream, new MediaStream(stream));
      
      // socket.emit('sendStream', { data: new MediaStream(stream), to: fromUser, from: bookingId });
      // setPeer(prev => { prev.addStream(stream);  return prev })
      // peer.addStream(stream)
      // setPeer1(new simplePeer({ initiator: true, trickle: false, stream: stream }));
    })
  })

  const startVideoChat = (id) => {
    if (!id) return;
    setChatWith(id);
  }

  const disconnect = () => {
    peer.destroy([`user left`])
  }

  return (
    <div>
      <div className="video">
        <div className="partner">
          <video id="remoteVideo" className="remote" controls muted autoPlay></video>
          <video id="localVideo" className="myself" controls muted autoPlay></video>
        </div>
      </div>
      {!window.location.pathname.includes(`fan`) && <>
        <button onClick={(e) => startVideoChat(`12345`)}>Chat With fan1</button> &nbsp;
        <button onClick={(e) => startVideoChat(`1234`)}>Chat With fan2</button>&nbsp; 
      </>}
      &nbsp;<button onClick={(e) => disconnect()}>Disconnect</button><br />
      <label>Enter Message:</label><br />
      <textarea id="yourMessage"></textarea>
      <button id="send" onClick={(e) => sendMessage()} >send</button>
      <pre id="messages"></pre>
    </div>
  );
}

export default React.memo(App);
