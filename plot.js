const margin = { top: 50, right: 40, bottom: 50, left: 60 };
const width = 1100 - margin.left - margin.right;
const height = 400 - margin.top - margin.bottom;

const svg = d3.select("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().domain([0, 1]).range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

svg.append("g").attr("transform", `translate(0,${height})`).attr("class", "x-axis");
svg.append("g").attr("class", "y-axis");

svg.append("text")
  .attr("text-anchor", "middle")
  .attr("x", width / 2)
  .attr("y", height + margin.bottom - 5)
  .attr("class", "axis-label")
  .text("Progress Through Surgery");

svg.append("text")
  .attr("text-anchor", "middle")
  .attr("transform", `rotate(-90)`)
  .attr("x", -height / 2)
  .attr("y", -margin.left + 15)
  .attr("class", "axis-label")
  .text("Average Vital Value");

const xAxis = d3.axisBottom(x).tickFormat(d3.format(".0%"));
const yAxis = d3.axisLeft(y);

const line = d3.line()
  .x(d => x(d.norm_time))
  .y(d => y(d.mean))
  .curve(d3.curveMonotoneX);

const area = d3.area()
  .x(d => x(d.norm_time))
  .y0(d => y(d.mean - (d.sd || 0)))
  .y1(d => y(d.mean + (d.sd || 0)))
  .curve(d3.curveMonotoneX);

const color = d3.scaleOrdinal(d3.schemeCategory10);

const vitalSelect = d3.select("#vitalSelect");
const groupSelect = d3.select("#groupSelect");

d3.csv("data/long_surgery_vitals.csv", d3.autoType).then(data => {
  data.forEach(d => d.signal = d.signal.toLowerCase());

  const vitals = [...new Set(data.map(d => d.signal))];
  const groups = ["optype", "emop"];

  vitalSelect.selectAll("option")
    .data(vitals).enter().append("option")
    .text(d => d).attr("value", d => d);

  groupSelect.selectAll("option")
    .data(groups).enter().append("option")
    .text(d => d === "optype" ? "Surgery Type" : "Emergency Status")
    .attr("value", d => d);

  function updateChart() {
    const selectedVital = vitalSelect.property("value");
    const selectedGroup = groupSelect.property("value");

    const filtered = data.filter(d => d.signal === selectedVital);
    const nested = d3.groups(filtered, d => d[selectedGroup]);

    const summary = nested.map(([key, values]) => {
      const binSize = 0.01;
      const binned = d3.groups(values, d => Math.round(d.norm_time / binSize) * binSize)
        .map(([t, pts]) => {
          const v = pts.map(p => p.value);
          return {
            norm_time: +t,
            mean: d3.mean(v),
            sd: d3.deviation(v)
          };
        });
      return { key, values: binned.sort((a, b) => a.norm_time - b.norm_time) };
    });

    y.domain([
      d3.min(summary, s => d3.min(s.values, d => d.mean - (d.sd || 0))),
      d3.max(summary, s => d3.max(s.values, d => d.mean + (d.sd || 0)))
    ]);

    svg.select(".x-axis").call(xAxis);
    svg.select(".y-axis").call(yAxis);

    svg.selectAll(".line").data(summary, d => d.key)
      .join("path")
      .attr("class", "line")
      .attr("fill", "none")
      .attr("stroke", d => color(d.key))
      .attr("stroke-width", 2)
      .attr("d", d => line(d.values));

      const legendContainer = d3.select("#legend");
      legendContainer.html(""); 
      const legendItems = legendContainer.selectAll("div")
      .data(summary.map(d => d.key))
      .enter()
      .append("div")
      .attr("class", "legend-item");
      legendItems.append("span")
      .attr("class", "legend-color")
      .style("background-color", d => color(d));
      legendItems.append("span")
      .attr("class", "legend-label")
      .text(d => d.length > 20 ? d.slice(0, 18) + "…" : d);
    }

  vitalSelect.on("change", updateChart);
  groupSelect.on("change", updateChart);

  vitalSelect.property("value", "map");
  groupSelect.property("value", "emop");
  updateChart();
});