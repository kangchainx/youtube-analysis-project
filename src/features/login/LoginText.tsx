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
    <div className="text-center">
      <h1
        className={cn(
          "scroll-m-20 text-4xl font-extrabold tracking-tight text-balance transition-opacity",
          isVisible ? "opacity-100" : "opacity-0",
        )}
      >
        {displayTextUp}
        <br />
        {displayTextDown}
      </h1>
    </div>
  );
}

export default LoginText;
