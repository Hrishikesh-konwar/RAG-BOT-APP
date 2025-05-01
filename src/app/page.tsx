import FileUploadComponent from '../component/file-upload';
import ChatComponent from '../component/chat'

export default function Home() {
  return (
    <div>
      <div className="min-h-screen w-screen flex bg-white pl-4 pr-4 pb-4">
        <div className="w-[30vw] min-h-screen border-2 border-black text-black p-4 justify-center items-center flex"> 
          <FileUploadComponent /> 
        </div>
        <div className="w-[65vw] min-h-screen border-2 border-black text-black p-4"> 
           <ChatComponent></ChatComponent>
        </div>
      </div>
    </div>
  );
}
