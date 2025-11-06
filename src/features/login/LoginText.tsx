import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function LoginText() {
  const textUp = "Youtube Analysis Tools";
  const textDown = "For Youtuers";
  const [displayTextUp, setDisplayTextUp] = useState("");
  const [displayTextDown, setDisplayTextDown] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let index1 = 0;
    let index2 = 0;
    const interval1 = setInterval(() => {
      if (index1 >= textUp.length) {
        clearInterval(interval1);
        return;
      }
      const ch = textUp[index1];
      setIsVisible(true);
      setDisplayTextUp((prev) => prev + ch);
      index1++;
    }, 100); // 每个字符间隔100ms
    const interval2 = setInterval(() => {
      if (index2 >= textDown.length) {
        clearInterval(interval2);
        return;
      }
      const ch = textDown[index2];
      setIsVisible(true);
      setDisplayTextDown((prev) => prev + ch);
      index2++;
    }, 200); // 每个字符间隔100ms
    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
    };
  }, []);

  return (
    <div className="relative text-center">
      <div
        aria-hidden="true"
        className="select-none text-4xl font-extrabold tracking-tight text-balance opacity-0"
      >
        {textUp}
        <br />
        {textDown}
      </div>
      <h1
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1 text-4xl font-extrabold tracking-tight text-balance transition-opacity",
          isVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <span>{displayTextUp}</span>
        <span>{displayTextDown}</span>
      </h1>
    </div>
  );
}

export default LoginText;
