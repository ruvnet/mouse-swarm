import {useEffect, useRef} from 'react';
import {createSwarmReveal} from '@ruvector/mouse-swarm';

// Targets are captured on mount. Remount this component if the target list changes.
export default function SwarmReveal(){
  const root=useRef(null),reveal=useRef(null);
  useEffect(()=>{
    const instance=createSwarmReveal({root:root.current,cursors:20,interval:280});
    reveal.current=instance;
    instance.start();
    return ()=>{instance.destroy();if(reveal.current===instance)reveal.current=null};
  },[]);
  return <>
    <main ref={root}>
      <h1 data-swarm-item data-swarm-type>Build something together.</h1>
      <p data-swarm-item data-swarm-type>Give ideas room to grow.</p>
      <a data-swarm-item href="https://github.com/ruvnet/ruflo">Explore Ruflo</a>
    </main>
    <nav aria-label="Animation controls">
      <button onClick={()=>reveal.current?.replay()}>Replay</button>
      <button onClick={()=>reveal.current?.pause()}>Pause</button>
      <button onClick={()=>reveal.current?.resume()}>Resume</button>
      <button onClick={()=>reveal.current?.skip()}>Skip animation</button>
    </nav>
  </>;
}
