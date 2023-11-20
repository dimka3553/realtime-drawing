import DrawingCanvas from "@/components/DrawingCanvas";
import { backendurl } from "@/constants";
export default function Home() {
  return <DrawingCanvas wsUrl={backendurl} />;
}
