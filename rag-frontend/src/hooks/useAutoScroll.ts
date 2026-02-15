import { useEffect, useRef, useState } from "react";

export const useAutoScroll = (dependency: unknown) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 80;
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

      setShouldAutoScroll(isNearBottom);
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !shouldAutoScroll) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [dependency, shouldAutoScroll]);

  const scrollToBottom = () => {
    if (!containerRef.current) return;

    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });

    setShouldAutoScroll(true);
  };

  return { containerRef, scrollToBottom };
};
