import WholeCanvas from "@/components/WholeCanvas";
import { backendurl } from "@/constants";

export default function Page(){
    return(
        <WholeCanvas wsUrl={backendurl}/>
    )
}