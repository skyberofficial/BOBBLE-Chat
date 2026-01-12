'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, Mic, MicOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { VoiceIntensity } from './voice-intensity';

interface CallOverlayProps {
    type: 'audio' | 'video';
    otherParticipant: {
        name: string;
        avatar?: string;
    };
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    onHangup: () => void;
    isIncoming?: boolean;
    onAccept?: () => void;
    onReject?: () => void;
    status: 'connecting' | 'active' | 'hangup' | 'incoming' | 'calling' | 'rejected';
}

export function CallOverlay({
    type,
    otherParticipant,
    localStream,
    remoteStream,
    onHangup,
    isIncoming,
    onAccept,
    onReject,
    status
}: CallOverlayProps) {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'active') {
            interval = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            setCallDuration(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream && type === 'video') {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className={cn(
            "fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-300",
            isFullScreen ? "bg-black" : "bg-black/90 backdrop-blur-xl"
        )}>
            {/* Background/Remote View */}
            <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                {type === 'video' && remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                        <Avatar className="h-32 w-32 border-4 border-primary/20 shadow-2xl">
                            <AvatarImage src={otherParticipant.avatar} alt={otherParticipant.name} />
                            <AvatarFallback className="text-4xl bg-primary/10 text-primary">{otherParticipant.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-white">{otherParticipant.name}</h2>
                            <p className={cn(
                                "font-medium mt-1 transition-colors duration-300",
                                status === 'rejected' ? "text-red-400" : "text-primary/80"
                            )}>
                                {status === 'incoming' ? 'Incoming call...' :
                                    status === 'calling' ? 'Calling...' :
                                        status === 'connecting' ? 'Connecting...' :
                                            status === 'rejected' ? 'Call Rejected' :
                                                status === 'active' ? formatDuration(callDuration) :
                                                    type === 'video' ? 'Video calling...' : 'Audio calling...'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Info Overlay for active video call */}
                {type === 'video' && status === 'active' && remoteStream && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 px-6 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 animate-in fade-in slide-in-from-top-4 duration-500">
                        <span className="text-white font-semibold text-sm">{otherParticipant.name}</span>
                        <span className="text-white/80 font-mono text-xs tabular-nums tracking-wider">{formatDuration(callDuration)}</span>
                    </div>
                )}
            </div>

            {/* Local Preview (Small Window) */}
            {type === 'video' && status !== 'incoming' && (
                <div className="absolute top-6 right-6 w-32 h-44 md:w-48 md:h-64 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-neutral-900 group">
                    {isVideoOff ? (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                            <CameraOff className="w-8 h-8 text-neutral-500" />
                        </div>
                    ) : (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                        />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-[10px] text-white font-medium uppercase tracking-wider">Local Preview</p>
                    </div>
                </div>
            )}

            {/* Top Bar (Mobile/Active) */}
            <div className="absolute top-6 left-6 flex flex-col gap-4 items-start">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/10"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                >
                    {isFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>

                {status === 'active' && localStream && (
                    <VoiceIntensity
                        stream={localStream}
                        isMuted={isMuted}
                        className="animate-in fade-in slide-in-from-left-4 duration-500"
                    />
                )}
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-12 flex items-center gap-4 md:gap-8 px-8 py-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                {status === 'incoming' ? (
                    <>
                        <Button
                            size="lg"
                            className="rounded-full h-14 w-14 bg-red-500 hover:bg-red-600 shadow-lg"
                            onClick={onReject}
                        >
                            <PhoneOff className="h-6 w-6 text-white" />
                        </Button>
                        <Button
                            size="lg"
                            className="rounded-full h-14 w-14 bg-green-500 hover:bg-green-600 shadow-lg"
                            onClick={onAccept}
                        >
                            <div className="flex flex-col items-center">
                                {type === 'video' ? <Camera className="h-6 w-6 text-white" /> : <Mic className="h-6 w-6 text-white" />}
                            </div>
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                                "rounded-full h-12 w-12 border-white/20",
                                isMuted ? "bg-red-500/20 text-red-500" : "bg-white/5 text-white"
                            )}
                            onClick={toggleMute}
                        >
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </Button>

                        {type === 'video' && (
                            <Button
                                variant="outline"
                                size="icon"
                                className={cn(
                                    "rounded-full h-12 w-12 border-white/20",
                                    isVideoOff ? "bg-red-500/20 text-red-500" : "bg-white/5 text-white"
                                )}
                                onClick={toggleVideo}
                            >
                                {isVideoOff ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                            </Button>
                        )}

                        <Button
                            size="lg"
                            className="rounded-full h-14 w-14 bg-red-500 hover:bg-red-600 shadow-xl"
                            onClick={onHangup}
                        >
                            <PhoneOff className="h-6 w-6 text-white" />
                        </Button>
                    </>
                )}
            </div>

            {/* Aesthetic Bottom Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-32 bg-primary/20 blur-[100px] pointer-events-none" />
        </div>
    );
}
