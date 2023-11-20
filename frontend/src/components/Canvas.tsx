"use client";
import React, { useEffect, useRef, useState } from "react";

type CanvasProps = {
  wsUrl: string;
};

interface PixelUpdate {
  x: number;
  y: number;
  brush: number;
}

interface DrawData {
  centerX: number;
  centerY: number;
  brush: number;
  radius: number;
}

interface Message {
  type: string;
  data: number[][] | PixelUpdate[] | DrawData;
}

const Canvas: React.FC<CanvasProps> = ({ wsUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [brush, setBrush] = useState<number>(1);
  const [radius, setRadius] = useState<number>(1);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const drawInitialCanvas = (data: number[][]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        const brush = data[y][x];
        ctx.fillStyle =
          brush === 1
            ? "red"
            : brush === 2
            ? "green"
            : brush === 3
            ? "blue"
            : "white";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  };

  const draw = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
  
    const centerX = Math.floor(clientX - rect.left);
    const centerY = Math.floor(clientY - rect.top);
  
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
  
    const pixelsToUpdate = [];
  
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y <= radius * radius) {
          const drawX = centerX + x;
          const drawY = centerY + y;
  
          ctx.fillStyle = brush === 1 ? "red" : brush === 2 ? "green" : "blue";
          ctx.fillRect(drawX, drawY, 1, 1);
  
          pixelsToUpdate.push({ x: drawX, y: drawY, brush });
        }
      }
    }
  
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "draw",
          data: { centerX, centerY, brush, radius },
        })
      );
    }
  };
  

  useEffect(() => {
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log("WebSocket connection opened");
    };

    wsRef.current.addEventListener("message", (event) => {
      const message: Message = JSON.parse(event.data);
    
      if (message.type === "init") {
        drawInitialCanvas(message.data as number[][]);
        console.log(message.data)
      } else if (message.type === "batchUpdate") {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
    
        const updates: PixelUpdate[] = message.data as PixelUpdate[];
        updates.forEach(({ x, y, brush }) => {
          ctx.fillStyle = brush === 1 ? "red" : brush === 2 ? "green" : "blue";
          ctx.fillRect(x, y, 1, 1);
        });
      }
    });
    return () => {
      wsRef.current?.close();
    };
  }, []);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(event.clientX, event.clientY);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      draw(event.clientX, event.clientY);
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    setIsDrawing(true);
    draw(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      const touch = event.touches[0];
      draw(touch.clientX, touch.clientY);
    }
  };

  return (
    <div>
      <select onChange={(e) => setBrush(Number(e.target.value))}>
        <option value={1}>Red</option>
        <option value={2}>Green</option>
        <option value={3}>Blue</option>
      </select>
      <select onChange={(e) => setRadius(Number(e.target.value))}>
        {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
          <option key={num} value={num}>
            {num}px
          </option>
        ))}
      </select>
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        style={{ border: "1px solid black" }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      ></canvas>
    </div>
  );
};

export default Canvas;
