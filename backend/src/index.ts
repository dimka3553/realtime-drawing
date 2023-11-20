import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import cors from "cors";

type User = {
  id: string;
  connection: WebSocket;
  startTimestamp: number;
  gridId: number;
};

const users: User[] = [];
const canvasCount = 20;
const canvasSize = 400;
const canvasGrid: number[][][] = Array.from({ length: canvasCount }, () =>
  Array.from({ length: canvasSize }, () =>
    Array.from({ length: canvasSize }, () => 0)
  )
);

const app = express();
app.use(cors({ origin: "*" }));
const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      // See zlib defaults.
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    // Other options settable:
    clientNoContextTakeover: true, // Defaults to negotiated value.
    serverNoContextTakeover: true, // Defaults to negotiated value.
    serverMaxWindowBits: 10, // Defaults to negotiated value.
    // Below options specified as default values.
    concurrencyLimit: 10, // Limits zlib concurrency for perf.
    threshold: 1024, // Size (in bytes) below which messages
    // should not be compressed if context takeover is disabled.
  },
});

const getRandomUnusedCanvas = () => {
  const usedCanvasIds = users.map((user) => user.gridId);
  const unusedCanvasIds = Array.from(
    { length: canvasCount },
    (_, i) => i
  ).filter((id) => !usedCanvasIds.includes(id));

  if (unusedCanvasIds.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * unusedCanvasIds.length);
  return unusedCanvasIds[randomIndex];
};

wss.on("connection", (ws) => {
  const userId = `${Date.now()}-${Math.random()}`;
  const gridId = getRandomUnusedCanvas();

  if (gridId === null) {
    ws.send(
      JSON.stringify({ type: "error", message: "All canvases are in use" })
    );
    ws.close();
    return;
  }

  const user: User = {
    id: userId,
    connection: ws,
    startTimestamp: Date.now(),
    gridId,
  };

  users.push(user);

  ws.send(JSON.stringify({ type: "init", data: canvasGrid, gridId }));

  setTimeout(() => {
    ws.send(JSON.stringify({ type: "timeUp" }));
    users.splice(users.indexOf(user), 1);
  }, 60000); // 1 minute

  ws.on("message", (message) => {
    const parsedMessage = JSON.parse(message.toString());

    if (parsedMessage.type === "draw") {
      const { centerX, centerY, brush, radius } = parsedMessage.data;
      const pixelsToUpdate = [];

      for (let y = -radius; y <= radius; y++) {
        for (let x = -radius; x <= radius; x++) {
          if (x * x + y * y <= radius * radius) {
            const drawX = centerX + x;
            const drawY = centerY + y;

            if (
              drawX >= 0 &&
              drawX < canvasSize &&
              drawY >= 0 &&
              drawY < canvasSize
            ) {
              canvasGrid[gridId][drawY][drawX] = brush;
              pixelsToUpdate.push({ x: drawX, y: drawY, brush });
            }
          }
        }
      }

      wss.clients.forEach((client) => {
        client.send(
          JSON.stringify({
            type: "batchUpdate",
            data: pixelsToUpdate,
            gridId,
          })
        );
      });
    }
  });
});

app.get("/", (req, res) => {
  res.send("hello world");
});

app.get("/delete", (req, res) => {
  //emtpy canvas
  canvasGrid.forEach((canvas) => {
    canvas.forEach((row) => {
      row.fill(0);
    });
  });
});

const port = 8080;
server.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});
