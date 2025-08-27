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
  faBars
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
} as const;

export type IconName = keyof typeof icons;

export const Icon: React.FC<{ name: IconName; className?: string; title?: string }> = ({ name, className, title }) => (
  <FontAwesomeIcon icon={icons[name]} className={className} title={title} />
);
