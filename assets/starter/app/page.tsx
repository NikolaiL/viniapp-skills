"use client";

import { useState } from "react";

export default function Home() {
  const [count, setCount] = useState(0);
  return (
    <main className="shell">
      <p className="eyebrow">App starter</p>
      <h1>Make it yours.</h1>
      <p className="intro">Replace this screen with your product. This interaction only checks that the starter works.</p>
      <button onClick={() => setCount(value => value + 1)}>Test interaction</button>
      <p role="status">Interactions: {count}</p>
    </main>
  );
}
