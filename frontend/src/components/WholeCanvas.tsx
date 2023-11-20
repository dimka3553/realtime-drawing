"use client";
import React, { useEffect, useRef, useState } from "react";
import QR from "./QR";

interface PixelUpdate {
  x: number;
  y: number;
  brush: number;
  gridId: number;
}

interface Message {
  type: string;
  data: number[][][] | PixelUpdate[];
  gridId: number;
}

const WholeCanvas: React.FC<{ wsUrl: string }> = ({ wsUrl }) => {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [assignedGridId, setAssignedGridId] = useState<number | null>(null);

  const drawInitialCanvas = (data: number[][], gridId: number) => {
    const ctx = canvasRefs.current[gridId]?.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(400, 400);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        const brush = data[y][x];
        const color =
          brush === 0
            ? [255, 255, 255, 255]
            : brush === 1
            ? [255, 0, 0, 255]
            : brush === 2
            ? [0, 255, 0, 255]
            : [0, 0, 255, 255];
        const index = (y * 400 + x) * 4;
        imageData.data.set(color, index);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("WebSocket connection opened");
    };

    wsRef.current.addEventListener("message", (event) => {
      const message: Message = JSON.parse(event.data);

      if (message.type === "init") {
        console.log(message.data);
        for (let i = 0; i < message.data.length; i++) {
          drawInitialCanvas(message.data[i] as number[][], i);
        }

        setAssignedGridId(message.gridId);
      } else if (message.type === "batchUpdate") {
        const ctx = canvasRefs.current[message.gridId]?.getContext("2d");
        if (!ctx) return;

        const updates: PixelUpdate[] = message.data as PixelUpdate[];
        updates.forEach(({ x, y, brush }) => {
          ctx.fillStyle =
            brush == 0
              ? "white"
              : brush === 1
              ? "red"
              : brush === 2
              ? "#00ff00"
              : "blue";
          ctx.fillRect(x, y, 1, 1);
        });
      }
    });

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="flex">
      <div className="grid grid-cols-5 w-fit max-h-screen flex-grow-0 flex-shrink-0">
        {Array.from({ length: 20 }, (_, i) => (
          <canvas
            key={i}
            ref={(el) => (canvasRefs.current[i] = el)}
            width={400}
            height={400}
            style={{
              maxWidth: "min(calc(100vw / 4), calc(100vh / 4))",
              maxHeight: "min(calc(100vw / 4), calc(100vh / 4))",
            }}
            className="w-full h-full aspect-square outline outline-black"
          ></canvas>
        ))}
      </div>
      <div className="flex items-center justify-center w-full">
        <div>
          <h1 className="text-4xl font-bold text-center">Scan to Draw</h1>
          <br />
          <QR/>
        </div>
      </div>
    </div>
  );
};

export default WholeCanvas;
