import { formatRound, Result } from "./common";

// Sorry this file is lowkey unmaintainable, its all chatgpt slop
// But hell no im not writing svg code manually

const color = ["#dc3545", "#6c757d", "#17a2b8", "#28a745"]; // 4th, 3rd, 2nd, 1st colours

/**
 * Generates an svg pie chart based on input data
 *
 * @param data Array of numbers summing to 1
 * @returns
 */
export const generatePieChartSvg = (data: number[], xOffset = 0): string => {
  const width = 200; // width of the SVG canvas
  const height = 200; // height of the SVG canvas
  const radius = 95; // radius of the pie
  const centerX = width / 2 + xOffset;
  const centerY = height / 2;

  let currentAngle = 0;

  // Reverse the array this gpt code generates the slices in th wrong direction.
  const slices = data
    .slice()
    .reverse()
    .map((slice: number, index: number) => {
      const sliceAngle = slice * 360 * 0.999; // random hack allow pie chart with only one sector to render correctly
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

      return `
          <path d="M${centerX},${centerY} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z" stroke="#fff" stroke-width="3" fill="${
        color[index]
      }" />
          <text x="${labelX}" y="${labelY}" text-anchor="middle" alignment-baseline="middle" font-weight="bold" font-size="26" font-family="monospace" fill="white">${formatRound(data[4 - index - 1] * 100)}%</text>
      `;
    });

  const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          ${slices.join("")}
      </svg>
  `;

  return svg;
};

export const generateLineChart = (data: Result[], width: number) => {
  const height = 200; // height of the SVG canvas
  const margin = 20; // margin around the chart
  const chartWidth = width - margin * 2;
  const chartHeight = height - margin * 2;

  // Find the min and max values from the data to scale the chart
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);

  // Function to scale the data points to fit in the chart area
  function scaleY(value: number) {
    return (
      ((value) / (maxValue - minValue)) * chartHeight +
      margin
    );
  }

  // Generate the path for the line connecting the points
  const pathData = data
    .map((point, index) => {
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = scaleY(point);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  // Generate circles for each data point
  const circles = data
    .map((point, index) => {
      const x = margin + (index / (data.length - 1)) * chartWidth;
      const y = scaleY(point);
      return `
      <circle cx="${x}" cy="${y}" r="12" fill="${
        color.slice().reverse()[point]
      }" />
      <circle cx="${x}" cy="${y}" r="6" fill="white" />
      `;
    })
    .join("");

  const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <path d="${pathData}" stroke="#b5c2ce" fill="transparent" stroke-width="5" />
      ${circles} <!-- Add circles for each data point -->
      </svg>
  `;

  return svg;
};

export const generateCombinedSvg = (results: Result[], rankRates: number[]) => {
  const width = 800;
  const height = 200;
  const lineGraphWidth = 600;
  
  // Use regex to strip off the svg tags, and then add then back on later.
  const lineSvg = generateLineChart(results, lineGraphWidth).replace(/<.?svg.*>/g, "");
  const pieSvg = generatePieChartSvg(rankRates, lineGraphWidth).replace(/<.?svg.*>/g, "");
  
  return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${pieSvg}
        ${lineSvg}
      </svg>
  `
}
