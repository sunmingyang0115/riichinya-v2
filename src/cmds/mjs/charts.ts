import { writeFileSync } from "fs";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import { formatPercent, formatRound } from "./common";

/**
 * Generates an svg pie chart based on input data
 * Credits to chatgpt for the main idea
 * 
 * Sorry this is lowkey unmaintainable
 *
 * @param data Array of numbers summing to 1
 * @returns 
 */
export const generatePieChartSvg = (data: number[]): string => {
  const width = 200; // width of the SVG canvas
  const height = 200; // height of the SVG canvas
  const radius = 80; // radius of the pie
  const centerX = width / 2;
  const centerY = height / 2;

  let currentAngle = 0;
  
  // Reverse the array this gpt code generates the slices in th wrong direction.
  const slices = data.reverse().map((slice: number, index: number) => {
    const sliceAngle = slice * 360;
    const x1 = centerX + radius * Math.cos((Math.PI / 180) * currentAngle);
    const y1 = centerY + radius * Math.sin((Math.PI / 180) * currentAngle);
    const x2 =
      centerX +
      radius * Math.cos((Math.PI / 180) * (currentAngle + sliceAngle));
    const y2 =
      centerY +
      radius * Math.sin((Math.PI / 180) * (currentAngle + sliceAngle));

    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

    // Calculate the centroid of the slice for the label position
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX =
      centerX + radius * 0.6 * Math.cos((Math.PI / 180) * labelAngle); // 0.7 factor to move the label inside the pie
    const labelY =
      centerY + radius * 0.6 * Math.sin((Math.PI / 180) * labelAngle);
    
    currentAngle += sliceAngle;
    
    const color = ["#dc3545", "#6c757d", "#17a2b8", "#28a745"]; // 4th, 3rd, 2nd, 1st colours

    return `
          <path d="M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z" stroke="#fff" fill="${
            color[index]
    }" />
          <text x="${labelX}" y="${labelY}" text-anchor="middle" alignment-baseline="middle" font-size="12" font-family="monospace" fill="white">${
      4 - index
    }: ${formatRound(data[4 - index - 1] * 100)}</text>
      `;
  });

  const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${slices.join("")}
      </svg>
  `;
  
  return svg;
};
