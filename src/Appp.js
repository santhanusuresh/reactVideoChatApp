import React, { useEffect, useState, useRef } from 'react';
import './App.css';
import getUserMedia from 'getusermedia';
import simplePeer from 'simple-peer';
import io from "socket.io-client";

const Appp = () => {

    const ENDPOINT = 'http://localhost:5001/';
    const [myId, setMyId] = useState("");
    const [users, setUsers] = useState({});
    const [stream, setStream] = useState();
    const [incomingCall, setIncomingCall] = useState(false);
    const [caller, setCaller] = useState("");
    const [calledTo, setCalledTo] = useState("");
    const [callerSignal, setCallerSignal] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [message, setMessage] = useState(``);
    const [txtMsg, setTxtMsg] = useState(``);
    const bookingId = window.location.pathname === `/fan1` ? `12345` : window.location.pathname === `/fan2` ? `1234` : `123`;

    const localVideo = useRef();
    const partnerVideo = useRef();
    const socket = useRef();
    const yourMessage = useRef();

    useEffect(() => {
        if (!myId) return;
        socket.current.emit('resetMyId', { bookingId })
    }, [myId])

    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => setMessage(``), 3000);
        return () => clearTimeout(timer);
    }, [message])

    useEffect(() => {
        socket.current = io(ENDPOINT);
        getUserMedia({ video: false, audio: true }, (error, stream) => {
            setStream(stream);
            if (localVideo.current) {
                localVideo.current.srcObject = stream;
            }
        })
        socket.current.on("myId", id => { setMyId(id) })
        socket.current.on("users", users => setUsers(users))
        socket.current.on("incomingCall", ({ signal, from }) => {
            setIncomingCall(true);
            setCaller(from);
            setCallerSignal(signal);
        })
        socket.current.on(`message`, ({ msg, from, to }) => {
            setTxtMsg(msg);
        });
        return () => {
            socket.current.close();
        }
    }, []);

    const call = id => {
        setCalledTo(id);
        const peer = new simplePeer({ initiator: true, trickle: false, stream: stream });
        peer.on("signal", data => { console.log("signal offer", peer); socket.current.emit("offer", { signal: data, to: id, from: myId }) })
        peer.on("stream", stream => { if (partnerVideo.current) partnerVideo.current.srcObject = stream });
        socket.current.on("callAccepted", signal => { setCallAccepted(true); peer.signal(signal) })
        socket.current.on("callDeclined", msg => {
            console.log("callDeclined",calledTo,partnerVideo.current.srcObject);
            setCallAccepted(false);
            setMessage(`${msg} by ${Object.keys(users).find(u => users[u] !== u && users[u] === id)}`)
        })
        socket.current.on('error', (error) => { console.log("socket error", error) });
        peer.on('error', (err) => { console.log("peer error", err) })
        socket.current.on('callDisconnected', () => {
            console.log("callDisconnected call",calledTo,partnerVideo.current.srcObject);
            setIncomingCall(false); setCalledTo(``);
            peer.removeStream(stream);
            peer.removeAllListeners();
            stopStreamedVideo(partnerVideo.current);
        });
    }

    const acceptCall = () => {
        setCallAccepted(true);
        const peer = new simplePeer({ initiator: false, trickle: false, stream: stream });
        peer.on("signal", data => socket.current.emit("answer", { signal: data, to: caller }))
        peer.on("stream", stream => partnerVideo.current.srcObject = stream);
        peer.signal(callerSignal);
        socket.current.on("callDeclined", msg => {
            console.log("callDeclined acceptCall ",calledTo,partnerVideo.current.srcObject);
            setCallAccepted(false);
            setMessage(`${msg} by ${Object.keys(users).find(u => users[u] !== u && users[u] === caller)}`)
        })
        socket.current.on('error', (error) => { console.log("socket error", error) });
        peer.on('error', (err) => { console.log("peer error", err) })
        socket.current.on('callDisconnected', () => {
            console.log("callDisconnected acceptCall",calledTo,partnerVideo.current.srcObject);
            setIncomingCall(false); setCalledTo(``);
            peer.removeStream(stream);
            peer.removeAllListeners();
            stopStreamedVideo(partnerVideo.current);
        });
    }

    // const sendMessage = () => {
    //     if (!yourMessage.current.value) return;
    //     socket.current.send({ msg: yourMessage.current.value, from: myId, to: caller ? caller : calledTo });
    // }

    const stopStreamedVideo = (videoElem) => {
        const stream = videoElem.srcObject;
        if (stream) {
            const tracks = stream.getTracks();
            tracks.forEach(track => {
                track.stop(); stream.removeTrack(track);
            });
            videoElem.srcObject = null;
        }
    }

    const declineCall = () => {
        console.log("disconnect",calledTo,partnerVideo.current.srcObject);
        setCallAccepted(false);
        setIncomingCall(false);
        socket.current.emit("declined", { to: caller ? caller : calledTo });
    }

    const getLocalVideo = _ => stream && (<video playsInline ref={localVideo} controls className="localVideo" muted autoPlay />);
    const getPartnerVideo = _ => stream && (<video playsInline ref={partnerVideo} controls className="partnerVideo" autoPlay />);
    const incomingCallIndicator = _ => (
        <div> <h1>Video Call from: {Object.keys(users).find(u => users[u] !== u && users[u] === caller)}</h1>
            <button onClick={acceptCall}>Accept</button>
            <button onClick={declineCall}>Decline</button>
        </div>
    )
    // const incomingCallIndicator = _ => {
    //     if (incomingCall && !callAccepted && caller) {
    //         const msg = `Accept video call from: ${Object.keys(users).find(u => users[u] !== u && users[u] === caller)}`;
    //         console.log("incomingCallIndicator",users,caller);

    //         let accepted = alert(msg);
    //         if(accepted) acceptCall();
    //     }
    // }

    const disconnect = () => {
        // if (calledTo && !partnerVideo.current.srcObject) return declineCall();
        stopStreamedVideo(partnerVideo.current);
        socket.current.emit(`disconnectCall`, { to: caller ? caller : calledTo }, () => { declineCall() })
    }

    return (
        <div>
            <div className="video">
                <div className="box">{getPartnerVideo()}{getLocalVideo()}</div>
                {console.log("incomingCall && !callAccepted", incomingCall && !callAccepted, incomingCall, callAccepted)}
                {incomingCall && !callAccepted && incomingCallIndicator()}
            </div>
            {!calledTo && !incomingCall && !callAccepted && Object.keys(users).map(key => {
                if (key === myId || key === bookingId || users[key] === key) {
                    return null;
                }
                return (
                    <button key={key} onClick={() => call(users[key])}>Call {key}</button>
                );
            })}
            <pre>{message}</pre>
            <button onClick={() => disconnect()}>Disconnect</button><br />
            {/* <label>Enter Message:</label><br />
            <textarea ref={yourMessage}></textarea>
            <button onClick={sendMessage} >send</button>
            <pre>{txtMsg}</pre> */}
        </div>
    );
}

export default Appp
