let margin = {top:30, right:70, bottom:60, left: 70};
let height;
let width = window.innerWidth * 0.6;


let config = {
    apiKey: "AIzaSyBxAfaXiBJcS7WtHrafZtEJjP1uZB3bpD0",
    authDomain: "mood-predictions.firebaseapp.com",
    databaseURL: "https://mood-predictions.firebaseio.com",
    projectId: "mood-predictions",
    storageBucket: "mood-predictions.appspot.com",
    messagingSenderId: "215668207165"
}

let db = firebase.initializeApp(config)
let dataStore = db.database()

let predRef = dataStore.ref('predictions')
let interventionsRef = dataStore.ref('interventions')
let ritualsRef = dataStore.ref('rituals')
let meanRef = dataStore.ref('runningMean')

async function getData() {
    let snapshot

    snapshot = await predRef.once('value')
    const predictions = Object.values(snapshot.val())

    snapshot = await interventionsRef.once('value')
    const interventions = Object.values(snapshot.val())
    
    snapshot = await ritualsRef.once('value')
    const rituals = Object.values(snapshot.val())
    
    snapshot = await meanRef.once('value')
    let means = Object.values(snapshot.val())
    
    let documentation = await d3.json("./documentation/doc_data.json")

    return { predictions, interventions, rituals, means, documentation }
}

getData().then(function(data){
    let margin = {top:30, right:70, bottom:60, left: 70};
    let width = window.innerWidth * 0.75;
    let height = data.predictions.length * 12;

    let chartSVG = d3.select("#charts")
        .attr("height", height + margin.top + margin.bottom + "px")
        .attr("width", width + margin.right + margin.left + "px")

    let yScale = d3.scaleTime()
        .domain(d3.extent(data.predictions, d => d.timestamp * 1000)) // filter after March 22
        .range([height - margin.bottom, margin.top])

    let xScale = d3.scaleLinear()
        .domain(d3.extent(data.predictions, d => d.LSTM_mood_prediction)) // needs to be difference from avg
        .range([margin.left, width - margin.right])

    let xTicks = d3.axisBottom(xScale)
        .tickSizeOuter(0)
        .tickPadding(10)

    let yTicks = d3.axisLeft(yScale)
        // .tickFormat(d => "$" + d)
        // .tickSize(-(width-margin.right-margin.left))
        .tickSizeOuter(0)
        .tickPadding(10)

    let xAxis = g => g
        // .attr("transform", "translate(0,"+(height-margin.bottom)+")") // move x axis to bottom of chart
        .call(xTicks)
        .call(g => g.select(".tick:first-of-type text").remove()) // removes first label on x axis
        .call(g => g.select(".tick:first-of-type line").remove()) // removes first tick on x axis
        .call(g => g.attr("class", "xAxis"))

    let yAxis = g => g
        .attr("transform", "translate(" + margin.right + ",0)") // enforces left margin
        .call(yTicks)
        .call(g => g.select(".tick:first-of-type line").remove()) // removes first y axis tick
        .call(g => g.attr("class", "yAxis"));

    chartSVG.append("g")
        .call(xAxis);

    chartSVG.append("g")
        .call(yAxis);

    data.predictions.forEach((d,i) => {
        if (d.timestamp !== null && d.timestamp * 1000 < (data.predictions[i+1].timestamp * 1000 - 24000000)){
            let obj = {}
            obj['LSTM_mood_prediction'] = null
            obj['LSTM_morale_prediction'] = null
            obj['LSTM_stress_prediction'] = null
            obj['LSTM_fatigue_prediction'] = null
            obj['timestamp'] = null
            data.predictions.splice(i+1, 0, obj)
        }
    })

    const line = d3.line()
        .defined(d => d.LSTM_mood_prediction !== null) // ends line when data ends
        .x(d => xScale(d.LSTM_mood_prediction))
        .y(d => yScale(d.timestamp * 1000));
    
    let moodLines = chartSVG.append("path")
        .datum(data.predictions) // pass conventional avocado data as default
        // .enter()
        // .append("path")
        .attr("class","line") // assigns general .line class
        // .attr("stroke", d => paletteLookup[d.key])
        .attr("d", line) // pass data to line function
})


// var t = d3.transition()
//         .duration(50)

// let paletteLookup;

// d3.csv("data/avocado.csv").then(function(data) {
//     // Avocado retail data from http://www.hassavocadoboard.com/retail/volume-and-price-data
//     // console.log(data)

//     let totalUSdata = [];
//     let regionalData = [];
//     let citiesData = [];

//     // parses date string to js datetime object
//     // https://github.com/d3/d3-time-format
//     const parseTime = d3.timeParse("%Y-%m-%d")

//     // loop through data, group by regional sections
//     data.forEach(d => {
//         d.Date = parseTime(d.Date)

//         // convert strings to ints
//         d.AveragePrice = +d.AveragePrice;
//         d.TotalVolume = +d.TotalVolume;

//         // collect rows labelled "TotalUS" in separate array
//         if(d.region == "TotalUS"){
//             totalUSdata.push(d)
//         }
//         // collect rows labelled with region names
//         else if(d.region =="Northeast" || 
//                 d.region =="GreatLakes" || 
//                 d.region =="Plains" || 
//                 d.region =="Southeast" || 
//                 d.region =="Midsouth" || 
//                 d.region =="SouthCentral" || 
//                 d.region =="West"){
//             regionalData.push(d)
//         }
//         // collect rows all other rows (labelled with cities)
//         else{
//             citiesData.push(d)
//         }
//     })

//     // console.log(totalUSdata)
//     // console.log(regionalData)
//     // console.log(citiesData)

//     nationalPricesChart(totalUSdata)
//     volumeByRegionChart(regionalData)
//     avgPriceByRegionChart(regionalData,citiesData)
// })


// // draw first chart

// function nationalPricesChart(data){

//     // convert time object to specific time string format
//     const weekify = d3.timeFormat("%U")

//     // create new key for week number
//     data.forEach(d => {
//         d.Week = +weekify(d.Date)
//     })

//     // nesting data http://bl.ocks.org/shancarter/raw/4748131/
//     let nestedUSdata = d3.nest()
//         .key(d => d.type)
//         .key(d => d.year)
//         .entries(data)

//     // console.log(nestedUSdata)

//     // define y axis properties
//     let yScale = d3.scaleLinear()
//         // domain (min and max) of y values
//         .domain([0, d3.max(data, d => d.AveragePrice)])
//         // range of chart's pixel values (y scale is flipped—origin is top-left of window)
//         .range([height - margin.bottom, margin.top])

//     // define x axis properties
//     let xScale = d3.scaleLinear()
//         // domain (min and max) of x values
//         .domain(d3.extent(data, d => d.Week))
//         // range of chart's pixel values
//         .range([margin.left, width - margin.right])
    
//     // convert from week number back to date object
//     const toDateObj = d3.timeParse("%U")
//     // convert from date object to new string format
//     const toDateString = d3.timeFormat("%b-%d")

//     // define properties for x axis ticks
//     let xTicks = d3.axisBottom(xScale)
//         .ticks(7) // number of ticks
//         .tickSizeOuter(0) // size of outer ticks
//         .tickFormat(d => toDateString(toDateObj(d))) // format week numbers to date strings
//         .tickPadding(10) // padding between ticks and labels 

//     let yTicks = d3.axisLeft(yScale)
//         .ticks(5)
//         .tickFormat(d => "$" + d)
//         .tickSize(-(width-margin.right-margin.left)) // elongates y axis ticks to span chart width
//         .tickSizeOuter(0)
//         .tickPadding(10)

//     // assemble x axis
//     let xAxis = g => g
//         .attr("transform", "translate(0,"+(height-margin.bottom)+")") // move x axis to bottom of chart
//         .call(xTicks)
//         .call(g => g.select(".tick:first-of-type text").remove()) // removes first label on x axis
//         .call(g => g.select(".tick:first-of-type line").remove()) // removes first tick on x axis
//         .call(g => g.attr("class", "xAxis")); // gives class of .xAxis

//     // assemble y axis
//     let yAxis = g => g
//         .attr("transform", "translate("+margin.left+",0)") // enforces left margin
//         .call(yTicks)
//         .call(g => g.select(".domain").remove()) // removes y axis line
//         .call(g => g.select(".tick:first-of-type line").remove()) // removes first y axis tick
//         .call(g => g.attr("class", "yAxis")); // gives class .yAxis

//     // select first svg
//     const svg = d3.select("#nationalPricesChart");
    
//     // define svg dimensions
//     svg.attr("width", width)
//         .attr("height", height);

//     // append x axis to svg
//     svg.append("g")
//         .call(xAxis);

//     // append y axis to svg
//     svg.append("g")
//         .call(yAxis);

//     // line function
//     const line = d3.line()
//         .defined(d => !isNaN(d.AveragePrice)) // ends line when data ends
//         .x(d => xScale(d.Week)) // scales x data to chart's x range
//         .y(d => yScale(d.AveragePrice)); // scales y data to chart's y range

//     // assign colors to keys in lookup
//     let years = nestedUSdata[0].values.map(d => d.key)
//     let palette = ["gold", "yellowgreen", "olivedrab", "darkgreen"]
//     paletteLookup = {};
//     years.forEach((d,i) =>{
//         paletteLookup[d] = palette[i];
//     })

//     // create lines
//     let priceLines = svg.append("g") // create a group element for lines
//         .selectAll("path")
//         .data(nestedUSdata[0].values) // pass conventional avocado data as default
//         .enter()
//         .append("path")
//         .attr("class","line") // assigns general .line class
//         .attr("stroke", d => paletteLookup[d.key])
//         .attr("d", d => line(d.values)) // pass data to line function

//     // emphasize $1 tick 
//     d3.selectAll("g.tick")
//         .filter(d => d==1) // filters $1 tick from rest of tick selections
//         .attr("class", "majorTick") // assigns special class to that tick

//     // create legend container
//     let colorKey = svg.append("g")
//         .attr("transform", "translate(25,40)")
//         .attr("id", "colorKey")
//     // create legend colors
//     colorKey.selectAll("rect")
//         .data(years)
//         .enter().append("rect")
//           .attr("height", 12)
//           .attr("x", width-margin.right * 2.15)
//           .attr("y", (d,i) => (height - margin.bottom * 2.25) - (20 * (palette.length - i)))
//           .attr("width", 12)
//           .attr("fill", d => paletteLookup[d])
//     // create legend labels
//     colorKey.selectAll("text")
//         .data(years)
//         .enter().append("text")
//             .attr("y", (d,i) => (height - margin.bottom * 2.1) - (20 * (palette.length - i)))
//             .attr("x", width-margin.right * 1.85)
//             .text(d => d)
//             .attr("class", "caption")

//     // select radio buttons (this is vanilla js)
//     let lineChoice = document.getElementById("nationalPricesForm");

//     // transition chart when a radio button is selected
//     lineChoice.oninput = () => {
//         let index = (lineChoice.radio.value == "conventional") ? 0 : 1;

//         priceLines.data(nestedUSdata[index].values)
//             .transition(t) // creates animation between transitioning svg elements
//             .attr("d", d => line(d.values)) // update lines with new data
//     }
// }



// function volumeByRegionChart(data){
//     data.forEach(d =>{
//         if(d.region== "GreatLakes" || d.region == "Plains"){
//             d.region = "Midwest"
//         }
//         else if(d.region == "Midsouth" || d.region == "SouthCentral" || d.region == "Southeast"){
//             d.region = "South"
//         }
//     })

//     let regionRollup = d3.nest()
//         .key(d => d.type)
//         .key(d => d.region)
//         .key(d => d.year)
//         .rollup(v => d3.sum(v, d => d.TotalVolume))
//         .entries(data)
        
//     let keys = regionRollup[0].values[0].values.map(d => d.key)

//     let stacks = d3.stack()
//         .keys(keys)
//         .value((d, key) => {
//             return d.values.find(d => d.key === key).value
//         })
    
//     let series = stacks(regionRollup[0].values)

//     let yRevScale = d3.scaleLinear()
//         .domain([0, (d3.sum(regionRollup[0].values[1].values, d => d.value))])
//         .range([height, margin.bottom])

//     let xScale = d3.scaleBand()
//         .domain(['Midwest', 'South', 'Northeast', 'West'])
//         .range([margin.left, width - margin.right])
//         .padding(0.05)

//     let xTicks = d3.axisBottom(xScale)
//         .ticks(4)
//         .tickSizeOuter(0)
//         .tickPadding(10)
//         .tickFormat(d => d.toString())

//     let xAxis = g => g
//         .attr("transform", "translate(0,"+(height - margin.bottom)+")")
//         .call(xTicks)
//         .call(g => g.attr("class", "xAxis"));

//     let yTicks = d3.axisLeft(yRevScale)
//         .ticks(4)
//         .tickSize(-(width-margin.right-margin.left))
//         .tickSizeOuter(0)
//         .tickPadding(10)
//         .tickFormat(d => d/1000000000 + " BIL")

//     let yAxis = g => g
//         .attr("transform", "translate("+margin.left+",0)")
//         .call(yTicks)
//         .call(g => g.select(".domain").remove())
//         .call(g => g.select(".tick:first-of-type text").remove())
//         .call(g => g.select(".tick:first-of-type line").remove())
//         .call(g => g.attr("class", "yAxis"));

//     const svg = d3.select("#volumeByRegionChart");

//     svg.attr("width", width)
//         .attr("height", height);

//     svg.append("g")
//         .attr("class", "x")
//         .call(xAxis);

//     svg.append("g")
//         .attr("class", "y")
//         .call(yAxis);

//     let regionBars = svg.append("g").attr("class", "bars")
//         .selectAll("g")
//         .data(series.reverse())
//             .enter()
//             .append('g')
//             .attr("class", d => d.key + "Bars") //region bars
            
//             .each((pd, i, elms) => {
//                 // Sub-chart
//                 d3.select(elms[i])
//                 .selectAll('rect')
//                 .data(pd)
//                 .enter()
//                 .append('rect')
//                     .attr("x", d => xScale(d.data.key))
//                     .attr("y", (d,i) => yRevScale(d[1]) - margin.bottom)
//                     .attr("height", d => yRevScale (d[0]) - yRevScale(d[0] + d[1]))
//                     .attr("width", xScale.bandwidth())
//                     .attr("fill", paletteLookup[pd.key])
//             })

//     // duplicate legend from first chart
//     var colorKeyHTML = d3.select("#colorKey").html()
//     var colorKey = svg.append('g')
//         .html(colorKeyHTML)
//         .attr("transform", "translate("+margin.left+","+margin.top+")")
//     colorKey.selectAll("rect")
//           .attr("x", xScale.bandwidth() - 70)
//           .attr("y", (d,i) => (margin.bottom) - (20 * (Object.keys(paletteLookup).length - i)))
//     colorKey.selectAll("text")
//         .attr("y", (d,i) => (margin.bottom+10) - (20 * (Object.keys(paletteLookup).length - i)))
//         .attr("x", xScale.bandwidth() - 50)


//     let barChoice = document.getElementById("volumeByRegionForm");

//     barChoice.oninput = () => {        
//         let index = (barChoice.radio.value =="conventional") ? 0 : 1;

//         // Recalculate data
//         let series = stacks(regionRollup[index].values)

//         // Update axes
//         yRevScale
//         .domain([0, (d3.sum(regionRollup[index].values[1].values, d => d.value))])
//         .range([height, margin.bottom])
        
//         yTicks.scale(yRevScale)

//         svg.selectAll("g.yAxis")
//             .transition(t)
//             .call(yAxis);

//         // Update bars
//         svg.selectAll("g.bars")
//             .selectAll("g")
//             .data(series.reverse())
//             .each((pd, i, elms) => {
//                 // Sub-chart
//                 d3.select(elms[i])
//                 .selectAll('rect')
//                 .data(pd)
//                 .transition(t)
//                 .attr("x", d => xScale(d.data.key))
//                 .attr("y", (d,i) => yRevScale(d[1]) - margin.bottom)
//                 .attr("height", d => yRevScale (d[0]) - yRevScale(d[0] + d[1]))
//                 .attr("width", xScale.bandwidth())
//                 .attr("class", (d, i) => {
//                     return "bar" + pd.key
//                 })
//             })
//         }
// }


// function avgPriceByRegionChart(regionalData, citiesData){
//     // combine both datasets for convenience
//     regionalData.forEach(d => citiesData.push(d))
//     // filter only rows labelled 2018
//     let allData2018 = citiesData.filter(d => d.year == "2018")

//     // nest data by type, then region
//     let regionalRollup = d3.nest()
//         .key(d => d.type)
//         .key(d => d.region)
//         .rollup(v => d3.mean(v, d => d.AveragePrice)) // calculate mean of average prices
//         .object(allData2018) // returns an object rather than an array

//     let cityCoordLookup = {};
//     let cities = Object.keys(regionalRollup['conventional']);

//     // create lookup table for city coordinates
//     d3.tsv("data/1000-largest-us-cities-by-population-with-geographic-coordinates.tsv").then(function(cityCoords){
//         cities.forEach(d => {
//             cityCoords.forEach(e =>{
//                 let citySplit = e['City'].split(' ')
//                 if((d !== "South" && d !=="Midwest" && d !=="Northeast" && d !=="West") && e['City'].includes(d) || d.includes(e['City']) || (d.includes(citySplit[citySplit.length-2]) && d.includes(citySplit[citySplit.length-1]))){
//                     cityCoordLookup[d] = []
//                     cityCoordLookup[d].push(e['Coordinates'].split(", "))
//                     let lat = parseFloat(cityCoordLookup[d][0][1])
//                     let long = parseFloat(cityCoordLookup[d][0][0])
//                     cityCoordLookup[d][0][0] = lat;
//                     cityCoordLookup[d][0][1] = long;
//                 }
//             })
//         })
//     })

//     console.log(cityCoordLookup)

//     // select third svg
//     const svg = d3.select("#avgPriceByRegionChart");

//     svg.attr("width", width)
//         .attr("height", height+100);

//     // get array of all prices for 2018 from dataset
//     let prices = regionalData.filter(d => d.year == "2018").map(d => d.AveragePrice)

//     // ready-to-use color schemes: https://github.com/d3/d3-scale-chromatic
//     let palette = ["gold", "#d3e534", "yellowgreen", "olivedrab", "#356d01","#37511f", "saddlebrown"]
//     let color = d3.scaleQuantize() // discrete range scale
//         .domain(d3.extent(prices)) // get max and min of our array of average prices
//         .range(palette) // map data to palette

//     // shapefiles from https://www.census.gov/geo/maps-data/
//     // convert to json at https://mapshaper.org/
//     d3.json("data/cb_2017_us_region_500k.json").then(function(regionShapes){

//         // calculates center of geojson
//         let center = d3.geoCentroid(regionShapes);

//         // define map projection
//         const projection = d3.geoMercator()
//             .scale(width)
//             .translate([width /2.75, height /3.75])
//             .center(center);

//         // define mapping function and pass in projection
//         const mapper = d3.geoPath().projection(projection);

//         // create div for tooltip
//         const tooltip = d3.select("#avgPriceByRegionContainer")
//             .append('div')
//             .attr('class', 'tooltip')
//             .style('display', "none");

//         // create group for map paths
//         svg.append("g")
//             .selectAll("g")
//             .data(regionShapes.features)
//             .enter()
//             .append("path")
//             .attr("d", d => mapper(d)) // draw map paths
//             .attr("fill", (d) => color(regionalRollup['conventional'][d.properties.NAME])) // get name of region from geojson, look up its average price from dataset, find color assigned to that price
//             .attr("class", "regionShapes")

//         // create group for city points
//         let cities = svg.append("g")
//             .selectAll("circle")
//             .data(Object.keys(cityCoordLookup))
//             .enter()
//             .append("circle")
//             .attr("cx", d => projection(cityCoordLookup[d][0])[0]) // projection returns an array of 2 points, get first point for x coordinate
//             .attr("cy", d => projection(cityCoordLookup[d][0])[1]) // get second point for y coordinate
//             .attr("r", 7)
//             .attr("fill", d => color(regionalRollup['conventional'][d])) // look up price for current city, get color assigned to that number
//             .attr("class", "cityPoints")
//             .on('mouseover', d => { // add an event listener for tooltip for each circle
//                 tooltip
//                   .transition()
//                   .duration(100)
//                   .style('display', "block"); // reveal div (default is display:none)
//                 tooltip
//                   .html("<b>"+d+":</b><br>" + "$" + Math.round(regionalRollup[mapChoice.radio.value][d] * 100) /100) // actual text of tooltip
//                   .style('left', d3.event.pageX - 60 + 'px')
//                   .style('top', d3.event.pageY - 220 + 'px');
//               })
//               .on('mouseout', () => {
//                 tooltip
//                   .transition()
//                   .duration(500)
//                   .style('display', "none");
//               });

//         // create a scale for color legend
//         const xScale = d3.scaleLinear()
//             .domain(d3.extent(color.domain())) // min and max of prices
//             .rangeRound([width-350, width-50]); // map colors to pixel values

//         // append group for legend and position
//         const colorKey = svg.append("g")
//             .attr("transform", "translate(25,40)");
//         colorKey.selectAll("rect")
//             .data(color.range().map(d => color.invertExtent(d))) // data is arrays of price ranges assigned to each color
//             .enter().append("rect")
//               .attr("height", 8)
//               .attr("x", d => xScale(d[0])) // get initial value of the price range, assign as x coordinat
//               .attr("width", d => xScale(d[1]) - xScale(d[0])) // subtract max value of price range from min value for width
//               .attr("fill", d => color(d[0])); // look up color for that price range
//         // create title of legend
//         colorKey.append("text")
//             .attr("class", "caption")
//             .attr("x", xScale.range()[0]) // start title at first color rect
//             .attr("y", -6)
//             .text("Average Price ($)");
//         // create "axis" for color legend
//         colorKey.call(d3.axisBottom(xScale)
//             .tickSize(13)
//             .tickValues(color.range().slice(1).map(d => color.invertExtent(d)[0]))) // get initial value of price ranges as axis labels
//           .select(".domain")
//             .remove();

//         let mapChoice = document.getElementById("avgPriceByRegionForm");

//         mapChoice.oninput = () => {
//             svg.selectAll("circle")
//                 .transition(t)
//                 .attr("fill", d => color(regionalRollup[mapChoice.radio.value][d]))
//             svg.selectAll(".regionShapes")
//                 .transition(t)
//                 .attr("fill", (d) => color(regionalRollup[mapChoice.radio.value][d.properties.NAME]))
//         }
//     })
// }