"use client";
import React, { useEffect, useRef, useState } from "react";

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

const DrawingCanvas: React.FC<{ wsUrl: string }> = ({ wsUrl }) => {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const [assignedGridId, setAssignedGridId] = useState<number | null>(null);
  const [brush, setBrush] = useState<number>(1);
  const [radius, setRadius] = useState<number>(5);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(63);
  const [allowTransition, setAllowTransition] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [drawingEnded, setDrawingEnded] = useState<boolean>(false);

  useEffect(() => {
    async function zoomIn() {
      const grid = document.querySelector(".grid") as HTMLDivElement;
      if (!grid) return;
      grid.style.transform = `scale(${
        Math.min(
          window.innerWidth / grid.offsetWidth,
          window.innerHeight / grid.offsetHeight,
        )
      })`;
      grid.style.transformOrigin = "top left";
      setIsZoomed(true);
      setAllowTransition(true);

      await new Promise((resolve) => setTimeout(resolve, 10));
      grid.style.transform = "scale(1)";
      centerCanvas();
      await new Promise((resolve) => setTimeout(resolve, 5000));
      setAllowTransition(false);
    }
    function centerCanvas() {
      if (assignedGridId !== null && !drawingEnded) {
        console.log(drawingEnded);
        const canvas = canvasRefs.current[assignedGridId];
        if (!canvas) return;
        const grid = document.querySelector(".grid") as HTMLDivElement;
        if (!grid) return;

        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const row = Math.floor(assignedGridId / 5); 
        const col = assignedGridId % 5;


        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;


        const centerX = col * canvasWidth + canvasWidth / 2;
        const centerY = row * canvasHeight + canvasHeight / 2;


        const translateX = screenWidth / 2 - centerX;
        const translateY = screenHeight / 2 - centerY;


        grid.style.transform = `translate(${translateX}px, ${translateY}px)`;
        grid.addEventListener("transitionend", transitionEndHandler);
      }
    }
    zoomIn();
    window.addEventListener("resize", centerCanvas);
  }, [assignedGridId]);
  const transitionEndHandler = () => {
    setShowControls(true);
  };

  function zoomOut() {
    setDrawingEnded(true);
    const grid = document.querySelector(".grid") as HTMLDivElement;
    if (!grid) return;

    grid.removeEventListener("transitionend", transitionEndHandler);

    setAllowTransition(true);
    grid.style.transform = `scale(${
      Math.min(
        window.innerWidth / grid.offsetWidth,
        window.innerHeight / grid.offsetHeight,
      )
    })`;
    grid.style.transformOrigin = "top left";
    setIsZoomed(false);
    setShowControls(false);
    setDrawingEnded(true);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTimeLeft) => {
        if (prevTimeLeft <= 1) {
          clearInterval(timer); 
          setDrawingEnded(true);
          zoomOut();
          return 0; 
        }
        return prevTimeLeft - 1; 
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const endDrawing = () => {
    setDrawingEnded(true);
    zoomOut();
    setTimeLeft(0);
  };

  const drawInitialCanvas = (data: number[][], gridId: number) => {
    const ctx = canvasRefs.current[gridId]?.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(400, 400);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 400; x++) {
        const brush = data[y][x];
        const color = brush === 0
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

  const draw = (clientX: number, clientY: number, gridId: number) => {
    if (gridId !== assignedGridId) return;

    const canvas = canvasRefs.current[gridId];
    if (!canvas) return;

    if (drawingEnded) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const centerX = Math.floor((clientX - rect.left) * scaleX);
    const centerY = Math.floor((clientY - rect.top) * scaleY);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(
      centerX - radius,
      centerY - radius,
      2 * radius + 1,
      2 * radius + 1,
    );

    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (x * x + y * y <= radius * radius) {
          const index = ((y + radius) * (2 * radius + 1) + (x + radius)) * 4;
          const color = brush === 0
            ? [255, 255, 255, 255]
            : brush === 1
            ? [255, 0, 0, 255]
            : brush === 2
            ? [0, 255, 0, 255]
            : [0, 0, 255, 255];
          imageData.data.set(color, index);
        }
      }
    }

    ctx.putImageData(imageData, centerX - radius, centerY - radius);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "draw",
          data: { centerX, centerY, brush, radius },
        }),
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
        for (let i = 0; i < message.data.length; i++) {
          drawInitialCanvas(message.data[i] as number[][], i);
        }

        setAssignedGridId(message.gridId);
      } else if (message.type === "batchUpdate") {
        const ctx = canvasRefs.current[message.gridId]?.getContext("2d");
        if (!ctx) return;

        const updates: PixelUpdate[] = message.data as PixelUpdate[];
        updates.forEach(({ x, y, brush }) => {
          ctx.fillStyle = brush == 0
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

  const handleMouseDown = (
    event: React.MouseEvent<HTMLCanvasElement>,
    gridId: number,
  ) => {
    if (gridId !== assignedGridId) return;
    setIsDrawing(true);
    draw(event.clientX, event.clientY, gridId);
  };

  const handleMouseUp = (gridId: number) => {
    if (gridId !== assignedGridId) return;
    setIsDrawing(false);
  };

  const handleMouseMove = (
    event: React.MouseEvent<HTMLCanvasElement>,
    gridId: number,
  ) => {
    if (gridId !== assignedGridId || !isDrawing) return;
    draw(event.clientX, event.clientY, gridId);
  };

  const handleTouchStart = (
    event: React.TouchEvent<HTMLCanvasElement>,
    gridId: number,
  ) => {
    if (gridId !== assignedGridId) return;
    const touch = event.touches[0];
    setIsDrawing(true);
    draw(touch.clientX, touch.clientY, gridId);
  };

  const handleTouchEnd = (gridId: number) => {
    if (gridId !== assignedGridId) return;
    setIsDrawing(false);
  };

  const handleTouchMove = (
    event: React.TouchEvent<HTMLCanvasElement>,
    gridId: number,
  ) => {
    if (gridId !== assignedGridId || !isDrawing) return;
    const touch = event.touches[0];
    draw(touch.clientX, touch.clientY, gridId);
  };

  return (
    <>
      <div
        className="flex items-center justify-between top-0 fixed left-0 w-screen p-5 z-50 select-none "
        style={{
          opacity: showControls && !drawingEnded ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div className="bg-[#00000066] backdrop-blur-2xl rounded-[9999px] p-3 select-none">
          <span className="text-slate-300">Time left:</span> {timeLeft}s
        </div>
        <button
          className="bg-[#00000066] backdrop-blur-2xl rounded-[9999px] p-3 text-yellow-500"
          onClick={endDrawing}
        >
          End Drawing
        </button>
      </div>{" "}
      <div
        className="grid grid-cols-5 fixed overflow-hidden select-none"
        style={{
          width: "min(450vw, 450vh)",
          height: "min(360vw, 360vh)",
          transition: allowTransition || drawingEnded
            ? "transform 2s ease-in-out"
            : "",
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <canvas
            key={i}
            ref={(el) => (canvasRefs.current[i] = el)}
            width={400}
            height={400}
            style={{
              outline: i === assignedGridId ? "" : "4px solid black",
              border: "4px solid black",
              zIndex: i === assignedGridId ? 2 : 0,
              width: "min(90vw, 90vh)",
              height: "min(90vw, 90vh)",
            }}
            className="aspect-square outline outline-black w-[90vh] h-[90vh] select-none"
            onMouseDown={(e) => handleMouseDown(e, i)}
            onMouseUp={() => handleMouseUp(i)}
            onMouseMove={(e) => handleMouseMove(e, i)}
            onTouchStart={(e) => handleTouchStart(e, i)}
            onTouchEnd={() => handleTouchEnd(i)}
            onTouchMove={(e) => handleTouchMove(e, i)}
          >
          </canvas>
        ))}
        <div
          className="fixed top-0 left-0 w-[1000vw] h-[1000vh] bg-black z-1 select-none"
          style={{
            opacity: isZoomed ? 0.5 : 0,
            transition: "opacity 2s ease-in-out",
          }}
        >
        </div>
      </div>
      <div
        className="fixed bottom-0 w-full mb-5 flex items-center justify-center z-50 select-none"
        style={{
          opacity: showControls && !drawingEnded ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
        }}
      >
        <div className="flex items-center flex-col gap-5">
          <div className="flex items-center gap-8 bg-[#00000066] rounded-[9999px] backdrop-blur-2xl select-none">
            <button
              className={"w-[50px] transition-[0.1s] h-[50px] flex items-center justify-center rounded-[9999px] " +
                (radius === 5 ? "border-2 border-white" : "")}
              onClick={() => {
                setRadius(5);
              }}
            >
              <svg
                width="16"
                height="28"
                viewBox="0 0 16 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1.56256 27C0.861196 25.9306 1.0141 23.8144 1.0141 22.5146C1.0141 20.831 1.02552 19.2876 1.69206 17.7632C2.49786 15.9202 3.34969 14.919 4.71625 13.6579C5.66471 12.7826 6.91615 11.5731 8.00705 12.6316C8.66438 13.2694 9.2813 14.0282 10.1476 13.4678C10.8494 13.0139 11.5085 12.3605 12.1205 11.7383C12.5044 11.3481 13.2726 10.8107 13.4612 10.1988C13.9019 8.76955 14.4797 7.55533 14.6572 5.96053C14.8435 4.28739 15 2.68938 15 1"
                  stroke="white"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              className={"w-[50px] transition-[0.1s] h-[50px] flex items-center justify-center rounded-[9999px] " +
                (radius === 10 ? "border-2 border-white" : "")}
              onClick={() => {
                setRadius(10);
              }}
            >
              <svg
                width="18"
                height="30"
                viewBox="0 0 18 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.56256 28C1.8612 26.9306 2.0141 24.8144 2.0141 23.5146C2.0141 21.831 2.02552 20.2876 2.69206 18.7632C3.49786 16.9202 4.34969 15.919 5.71625 14.6579C6.66471 13.7826 7.91615 12.5731 9.00705 13.6316C9.66438 14.2694 10.2813 15.0282 11.1476 14.4678C11.8494 14.0139 12.5085 13.3605 13.1205 12.7383C13.5044 12.3481 14.2726 11.8107 14.4612 11.1988C14.9019 9.76955 15.4797 8.55533 15.6572 6.96053C15.8435 5.28739 16 3.68938 16 2"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </button>{" "}
            <button
              className={"w-[50px] transition-[0.1s] h-[50px] flex items-center justify-center rounded-[9999px] " +
                (radius === 15 ? "border-2 border-white" : "")}
              onClick={() => {
                setRadius(15);
              }}
            >
              <svg
                width="20"
                height="32"
                viewBox="0 0 20 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.56256 29C2.8612 27.9306 3.0141 25.8144 3.0141 24.5146C3.0141 22.831 3.02552 21.2876 3.69206 19.7632C4.49786 17.9202 5.34969 16.919 6.71625 15.6579C7.66471 14.7826 8.91615 13.5731 10.007 14.6316C10.6644 15.2694 11.2813 16.0282 12.1476 15.4678C12.8494 15.0139 13.5085 14.3605 14.1205 13.7383C14.5044 13.3481 15.2726 12.8107 15.4612 12.1988C15.9019 10.7696 16.4797 9.55533 16.6572 7.96053C16.8435 6.28739 17 4.68938 17 3"
                  stroke="white"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-8 bg-[#00000066] rounded-[9999px] backdrop-blur-2xl p-2">
            <button
              className={"w-[44px] transition-[0.1s] h-[44px] flex items-center justify-center rounded-[9999px] bg-white " +
                (brush === 0 ? "border-2 border-yellow-500" : "")}
              onClick={() => {
                setBrush(0);
              }}
            >
            </button>
            <button
              className={"w-[44px] transition-[0.1s] h-[44px] flex items-center justify-center rounded-[9999px] bg-[#ff0000] " +
                (brush === 1 ? "border-2 border-yellow-500" : "")}
              onClick={() => {
                setBrush(1);
              }}
            >
            </button>
            <button
              className={"w-[44px] transition-[0.1s] h-[44px] flex items-center justify-center rounded-[9999px] bg-[#00ff00] " +
                (brush === 2 ? "border-2 border-yellow-500" : "")}
              onClick={() => {
                setBrush(2);
              }}
            >
            </button>
            <button
              className={"w-[44px] transition-[0.1s] h-[44px] flex items-center justify-center rounded-[9999px] bg-[#0000ff] " +
                (brush === 3 ? "border-2 border-yellow-500" : "")}
              onClick={() => {
                setBrush(3);
              }}
            >
            </button>
          </div>
        </div>
      </div>
      <div
        className="w-screen h-screen fixed flex top-0 left-0 items-center justify-center"
        style={{
          opacity: drawingEnded ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
          display: drawingEnded ? "flex" : "none",
        }}
      >
        <div className="p-5 backdrop-blur-2xl bg-[#00000066] text-xl flex flex-col gap-5 items-center">
          The End, thank you for drawing!
          <img
            width={200}
            height={200}
            src="https://ih1.redbubble.net/image.864113893.4600/st,small,507x507-pad,600x600,f8f8f8.u2.jpg"
          >
          </img>
        </div>
      </div>
    </>
  );
};

export default DrawingCanvas;
