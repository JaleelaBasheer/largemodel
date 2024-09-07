import './App.css';
import CompressedFbx from './components/CompressedFbx';
import FbxFileLoader from './components/FbxFileLoader';
// import ThreeBoxes from './components/ThreeBoxes';
import ThreeBoxes from './components/MoreBoxes';
import FBXViewer from './components/NewFbxFileLoader';
import FinalLargeSceneModel from './components/FinalLargeSceneModel'
import MoreBoxes from './Largecomponent/MoreBoxes';
import MultipleModelLoader from './LargefbxModels/ModalFBX';
import FinalLargeScene from './Custom/LargeScene';
import RandomBoxesScene from './GenerateBox/RandomBoxes';
import RandomObjectsScene from './GenerateBox/RandomObjectScene';
import Randomfbxfiles from './GenerateBox/Randomfbxfiles';

function App() {
  return (
    <div >
      {/* <ThreeBoxes/> */}
      {/* <FbxFileLoader/> */}
      {/* <CompressedFbx/> */}
      {/* <FBXViewer/> */}
      {/* <Cubes/> */}
      {/* <FinalLargeSceneModel/> */}
      {/* <MoreBoxes/> */}
      {/* <MultipleModelLoader/> */}
      {/* <FinalLargeScene/> */}
      {/* <RandomBoxesScene/> */}
      {/* <RandomObjectsScene/> */}
      <Randomfbxfiles/>


    </div>
  );
}

export default App;
