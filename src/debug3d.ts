import { CarShowroom } from "./renderers/3d/CarShowroom";
import "./renderers/3d/showroom.css";

const showroom = new CarShowroom();
Object.assign(window, { carShowroom: showroom });
