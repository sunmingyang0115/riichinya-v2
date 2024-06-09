import 'dotenv/config';
import { Bot } from './data/bot';

const riichinya = new Bot(process.env.TOKEN);
riichinya.run();

// interface Shape {
//     getName(): string;
//     getPerimeter(): number;
//     getArea(): number;
// }

// class Square implements Shape {
//     private sideLength;
//     public constructor(readonly _sideLength: number) {
//         this.sideLength = _sideLength;
//     } 
//     public getName(): string {
//         return "Square";
//     }
//     public getPerimeter(): number {
//         return 2*(this.sideLength+this.sideLength);
//     }
//     public getArea(): number {
//         return this.sideLength*this.sideLength;
//     }
// }


// const s = new Square(123);
// console.log(s.getName());
// console.log(s.getArea());
// console.log(s.getPerimeter());