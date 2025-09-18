"use client";
import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGear,
  faSliders,
  faCircleInfo,
  faComments,
  faScrewdriverWrench,
  faScroll,
  faDatabase,
  faStar,
  faXmark,
  faBars,
  faThumbsUp,
  faThumbsDown,
  faMinus,
  faUpRightAndDownLeftFromCenter,
  faChevronDown,
  faRotateRight,
  faPalette,
  faCopy,
  faCheck,
  faSquare,
} from "@fortawesome/free-solid-svg-icons";

const icons = {
  gear: faGear,
  sliders: faSliders,
  info: faCircleInfo,
  comments: faComments,
  tools: faScrewdriverWrench,
  scroll: faScroll,
  db: faDatabase,
  star: faStar,
  close: faXmark,
  bars: faBars,
  thumbsUp: faThumbsUp,
  thumbsDown: faThumbsDown,
  minus: faMinus,
  expand: faUpRightAndDownLeftFromCenter,
  chevronDown: faChevronDown,
  refresh: faRotateRight,
  palette: faPalette,
  copy: faCopy,
  check: faCheck,
  stop: faSquare,
} as const;

export type IconName = keyof typeof icons;

export const Icon: React.FC<{ name: IconName; className?: string; title?: string; style?: React.CSSProperties }> = ({ name, className, title, style }) => (
  <FontAwesomeIcon icon={icons[name]} className={className} title={title} style={style} />
);
