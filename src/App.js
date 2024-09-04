import './App.css';
import CompressedFbx from './components/CompressedFbx';
import FbxFileLoader from './components/FbxFileLoader';
// import ThreeBoxes from './components/ThreeBoxes';
import ThreeBoxes from './components/MoreBoxes';
import FBXViewer from './components/NewFbxFileLoader';
import Cubes from './Custom/Cubes';
import SceneCanvas from './Largecomponent/SceneCanvas';
import SceneManager from './Largecomponent/SceneManager';

function App() {
  return (
    <div >
      {/* <ThreeBoxes/> */}
      {/* <FbxFileLoader/> */}
      {/* <CompressedFbx/> */}
      {/* <FBXViewer/> */}
      {/* <SceneManager/> */}
      <Cubes/>
     
    </div>
  );
}

export default App;
