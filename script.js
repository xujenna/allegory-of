
// let config = {
//     apiKey: "AIzaSyBxAfaXiBJcS7WtHrafZtEJjP1uZB3bpD0",
//     authDomain: "mood-predictions.firebaseapp.com",
//     databaseURL: "https://mood-predictions.firebaseio.com",
//     projectId: "mood-predictions",
//     storageBucket: "mood-predictions.appspot.com",
//     messagingSenderId: "215668207165"
// }

// let db = firebase.initializeApp(config)
// let dataStore = db.database()

// let predRef = dataStore.ref('predictions')
// let interventionsRef = dataStore.ref('interventions')
// let ritualsRef = dataStore.ref('rituals')
// let meanRef = dataStore.ref('runningMean')

// async function getData() {
//     let snapshot

//     snapshot = await predRef.once('value')
//     const predictions = Object.values(snapshot.val())

//     snapshot = await interventionsRef.once('value')
//     const interventions = Object.values(snapshot.val())
    
//     snapshot = await ritualsRef.once('value')
//     const rituals = Object.values(snapshot.val())
    
//     snapshot = await meanRef.once('value')
//     let means = Object.values(snapshot.val())
    
//     let documentation = await d3.json("./data/doc_data.json")
//     let historicalMeans = await d3.json("./data/historical_means.json")
//     let gratitudeLog = await d3.json("./data/gratitude.json")

//     return { predictions, interventions, rituals, means, documentation, historicalMeans, gratitudeLog }
// }

async function getData(){
    console.log("getting data")
    let data = await d3.json("./data/db_data.json")
    // let documentation = await d3.json("./data/doc_data.json")
    // data['documentation'] = documentation
    return data
}

getData().then(function(data){
    console.log(data)

    Object.keys(data).forEach(key => {
        data[key] = data[key].filter(d => d.timestamp > 1555164021 && d.timestamp < 1556965804)
        data[key] = data[key].map(d =>{d.timestamp = d.timestamp * 1000; return d})
    })
    data.gratitudeLog.forEach(d => {
        d.gratitude_entries.forEach(entry => {
            data.documentation.push(entry)
        })
    })
    
    console.log(data)

    let nullItems = []
    data.predictions.forEach((d,i,obj) => {
        d['mean_deltas'] = {}

        if (d.timestamp !== null && i < (obj.length -1) && d.timestamp < (data['predictions'][i+1].timestamp - 60 * 60 * 5 * 1000)){
            let nullObj = {}
            nullObj['LSTM_mood_prediction'] = null
            nullObj['LSTM_morale_prediction'] = null
            nullObj['LSTM_stress_prediction'] = null
            nullObj['LSTM_fatigue_prediction'] = null
            nullObj['timestamp'] = null
            obj.splice(i+1, 0, nullObj)
            nullItems.push(i+1)
        }
    })
    
    let oldThresholds = {
        fatigue: 3.05,
        stress: 1.3,
        morale: 2.9,
        mood: 2.8
    }

    let allKeys = Object.keys(data['predictions'][0])
    let keys = allKeys.filter(key => {return key !== "runningMean" && key !== "timestamp" && key !== "mean_deltas"})

    data.predictions.forEach((d,i,obj) => {
        d['mean_deltas'] = {}

        keys.forEach(key => {
            let marker = key.replace("LSTM_", "").replace("_prediction", "")

            if (d[key] == null){
                d['mean_deltas'][marker + "_mean_delta"] = null;
            }
            else if(d['runningMean']){
                let meanKey = "total" + (marker.charAt(0).toUpperCase() + marker.slice(1)) + "Pred"
                if(marker == "mood" || key == "morale"){
                    d['mean_deltas'][marker + "_mean_delta"] = (d[key] - (d['runningMean'][meanKey] / d['runningMean']['totalPredictions'])) * -1
                }
                else{
                    d['mean_deltas'][marker + "_mean_delta"] = d[key] - (d['runningMean'][meanKey] / d['runningMean']['totalPredictions'])
                }
            }
            else if (d[key]){
                if(marker == "mood" || key == "morale"){
                    d['mean_deltas'][marker + "_mean_delta"] = (d[key] - oldThresholds[marker]) * -1
                }
                else{
                    d['mean_deltas'][marker + "_mean_delta"] = d[key] - oldThresholds[marker]
                }
            }
        })

    })

    data.interventions.forEach(intervention => {
        let timestamp = intervention.timestamp

        data.predictions.forEach(prediction => {
            if(prediction.timestamp == timestamp){
                intervention['mean_delta'] = prediction['mean_deltas'][intervention.marker + '_mean_delta']
            }
        })
    })
    // console.log(nullItems)
    // console.log(data.predictions.slice(0, (nullItems[0] + 1)))
    let nullIndex = 0
    let currentPredictions = data.predictions.slice(0, (nullItems[nullIndex] + 1))
    console.log(currentPredictions)
    let margin = {top:30, right:70, bottom:60, left: 30};
    let width = window.innerWidth * 0.9;
    let height = currentPredictions.length * 150;
    let axisWidth = width * 0.1

    let chartSVG = d3.select("#charts")
        .attr("height", height + margin.top + margin.bottom + "px")
        .attr("width", width + margin.right + margin.left + "px")

    let yScale = d3.scaleTime()
        .domain([currentPredictions[0]['timestamp'], currentPredictions[currentPredictions.length - 2]['timestamp']])
        .range([height - margin.bottom, margin.top])

    let xScale = d3.scaleLinear()
        // .domain([d3.min(data.predictions, d => d.LSTM_morale_prediction),d3.max(data.predictions, d=> d.LSTM_stress_prediction)])
        .domain([-2,2]) // needs to be difference from avg
        .range([margin.left, axisWidth])
    
    let xTicks = d3.axisTop(xScale)
        .ticks(2)
        .tickFormat(d => {
            if(d == 0){
                return "average"
            }
            else if (d > 0){
                return "worse"
            }
            else {
                return "better"
            }
        })
        .tickSizeOuter(0)
        .tickPadding(10)
        .tickSize(6)
    let yTicks = d3.axisLeft(yScale)
        // .tickFormat(d => "$" + d)
        // .tickSize(-(width-margin.right-margin.left))
        .ticks(d3.timeMinute.every(120))
        .tickSizeOuter(0)
        .tickPadding(10)

    let xAxis = g => g
        .attr("transform", "translate(0,"+(margin.top)+")") // move x axis to bottom of chart
        .call(xTicks)
        // .call(g => g.select(".tick:first-of-type text").remove()) // removes first label on x axis
        // .call(g => g.select(".tick:first-of-type line").remove()) // removes first tick on x axis
        .call(g => g.attr("class", "xAxis"))

    let yAxis = g => g
        .attr("transform", "translate(" + xScale(0) + ",0)") // enforces left margin
        .call(yTicks)
        .call(g => g.select(".tick:first-of-type line").remove()) // removes first y axis tick
        .call(g => g.attr("class", "yAxis"));

    chartSVG.append("g")
        .call(xAxis);

    chartSVG.append("g")
        .call(yAxis);
    

    let deltasArray = Object.keys(data.predictions[0]['mean_deltas'])
    // predictionArray.pop()
    // predictionArray = predictionArray.reverse()

    deltasArray.forEach(variable => {
        const line = d3.line()
            .defined(d => d['mean_deltas'][variable] !== null)
            .x(d => xScale(d['mean_deltas'][variable]))
            // .x(d => {
            //     let marker = variable.replace("LSTM_", "").replace("_prediction", "")

            //     if(d['runningMean']){
            //         let meanKey = "total" + (marker.charAt(0).toUpperCase() + marker.slice(1)) + "Pred"
            //         return xScale(d[variable] - (d['runningMean'][meanKey] / d['runningMean']['totalPredictions']))
            //     }
            //     else{
            //         return xScale(d[variable] - oldThresholds[marker])
            //     }

            // })
            .y(d => yScale(d.timestamp))
            // .y0(yScale(0))
        const area = d3.area()
            .defined(d => d[variable] !== null)
            .x1(d => xScale(d[variable]))
            .y(d => yScale(d.timestamp))
            .x0(xScale(0))

        chartSVG.append("path")
            .datum(currentPredictions)
            .attr("class", "predLine prediction " + variable.replace("_mean_delta", ""))
            .attr("d", line)
    })
    let interventionLines = chartSVG.append("g")
        .selectAll("line")
        .data(data['interventions'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("line")
            .attr("x1", d => xScale(d['mean_delta']))
            .attr("x2", xScale.range()[1] + 100)
            .attr("y1", d => yScale(d.timestamp))
            .attr("y2", d => yScale(d.timestamp))
            .attr("class", d => d.marker + " interventions interventionLine")
    let interventionPTS = chartSVG.append("g")
        .selectAll("circle")
        .data(data['interventions'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("circle")
            .attr("class", d => "interventions interventionPTS " + d.marker)
            .attr("cx", d => xScale(d['mean_delta']))
            .attr("cy", d => yScale(d.timestamp))
            .attr("r", 3)
    let interventionText = chartSVG.append("g")
        .selectAll("text")
        .data(data['interventions'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("text")
            .attr("class", d => "interventions interventionTXT " + d.marker)
            .attr("id", d => "text" + d.timestamp)
            .attr("x", xScale.range()[1]+ 104)
            .attr("y", d => yScale(d.timestamp))
            .text(d => d.content)
        .on("click", d => {
            let idName = "intervention" + d.timestamp.toString().split(".")[0]
            if(document.getElementById(idName)){
                let deet = d3.select("#" + idName)
                if(deet.style("display") == "none"){
                    deet.style("display", "block")
                }
                else{
                    deet.style("display", "none")
                }
            }
            else{
                d3.select("#chart").append("div")
                    .html("<p><b>Marker: </b>" + d.marker + "<br>" + "<p><b>Intervention: </b>" + d.intervention + "<br>" + "<p><b>Content: </b>" + d.content + "</p>")
                    .attr("class", "deets interventions " + d.marker)
                    .attr("id", idName)
                    .style("left", xScale.range()[1]+ 104)
                    .style("top", yScale(d.timestamp ))
                    // .style('left', d3.event.pageX - margin.left - margin.right + 'px')
                    // .style('top', d3.event.pageY - margin.top - margin.bottom + 'px');
            }
        })

    let ritualLines = chartSVG.append("g")
        .selectAll("line")
        .data(data['rituals'].filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness" && d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("line")
            .attr("x1", xScale(0))
            .attr("x2", xScale.range()[1] + 100)
            .attr("y1", d => yScale(d.timestamp ))
            .attr("y2", d => yScale(d.timestamp ))
            .attr("class", "rituals ritualLine")
    let ritualPTS = chartSVG.append("g")
        .selectAll("circle")
        .data(data['rituals'].filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness" && d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("circle")
            .attr("class","rituals ritualPTS")
            .attr("cx", xScale(0))
            .attr("cy", d => yScale(d.timestamp ))
            .attr("r", 3)
    let ritualText = chartSVG.append("g")
        .selectAll("text")
        .data(data['rituals'].filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness" && d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("text")
            .attr("class", "rituals ritualTXT")
            .attr("x", xScale.range()[1]+ 104)
            .attr("y", d => yScale(d.timestamp ))
            .text(d => d.content)
        .on("click", d => {
            let idName = "ritual" + d.timestamp.toString().split(".")[0]
            if(document.getElementById(idName)){
                let deet = d3.select("#" + idName)
                if(deet.style("display") == "none"){
                    deet.style("display", "block")
                }
                else{
                    deet.style("display", "none")
                }
            }
            else{
                d3.select("#chart").append("div")
                    .html("<p><b>Ritual: </b>" + d.ritual + "<br>" + "<p><b>Content: </b>" + d.content + "</p>")
                    .attr("class", "deets rituals")
                    .attr("id", idName)
                    .style("left", xScale.range()[1]+ 104)
                    .style("top", yScale(d.timestamp ))
            }
        })
    // let gratitudeText = chartSVG.selectAll("g")
    //     .data(data['gratitudeLog'])
    //     .enter()
    //     .append("g")
    //     .selectAll("text")
    //         .data(d => d.gratitude_entries)
    //         .enter()
    //         .append("div")
    //             .attr("class", "documentation docTXT")
    //             .attr("x", xScale.range()[1]+ 650)
    //             .attr("y", d => yScale(d.timestamp ))
    //             .text(d => d.entry)

    // let gratitudeText = d3.select("#chart")
    //     .selectAll("div")
    //     .data(data['gratitudeLog'])
    //     .enter()
    //     .append("div")
    //     .attr("class", "documentation docTXT")
    //     .html(d=>{
    //         let html = ""
    //         d.gratitude_entries.forEach(entry=>{
    //             console.log(entry.entry)
    //             html += "<p>" + entry.entry + "</p>"
    //         })
    //         console.log(html)
    //         return html
    //     })
    //     .style("left", xScale.range()[1] + 650)
    //     .style("top", d => yScale(d['gratitude_entries'][0].timestamp ))

    let gratitudeLines = chartSVG.selectAll("g")
        .data(data['gratitudeLog'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("g")
        .selectAll("line")
            .data(d => d.gratutde_entries)
            .enter()
            .append("line")
                .attr("x1", xScale(0))
                .attr("x2", xScale.range()[1] + 650)
                .attr("y1", d => yScale(d.timestamp ))
                .attr("y2", d => yScale(d.timestamp ))
                .attr("class", "documentation docLine")

    let documentation = d3.select("#chart")
        .selectAll("div")
        .data(data['documentation'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("div")
            // .attr("class", d => d.extension.slice(1,d.extension.length) + " documentation")
            .attr("class", d => "intervention" + d.timestamp.toString().split(".")[0] + " documentation")
            .attr("id", d => "doc" + d.timestamp)
            .html(d => {
                d.fileName
                if(d.extension == ".jpg"){
                    return "<img src='documentation/files/"+ d.fileName + "' width='55%'>"
                }
                else if (d.extension == ".gif"){
                    return "<img src='documentation/files/"+ d.fileName + "' width='85%'>"
                }
                else if (d.extension == ".mp3"){
                    return "<audio controls><source src='documentation/files/" +  d.fileName + "' type='audio/mpeg'> Your browser does not support the audio element.</audio>"
                }
                else if (d.extension == ".mp4"){
                    return "<video width='55%' controls><source src='documentation/files/" +  d.fileName + "' type='video/mp4'>Your browser does not support the video tag.</video>"
                }
                else if (d.extension == undefined){
                    return "<p>" + d.entry + "</p>"
                }
            })
            .style("left", xScale.range()[1] + 650)
            // (d,i) => {
                // if(i>0 && d.timestamp <= (data['documentation'][i-1].timestamp + 60 * 120)){
                //     return xScale.range()[1] + 650 + document.getElementById("doc" + data['documentation'][i-1].timestamp).getBoundingClientRect().width;
                // }
                // else {
                    // return xScale.range()[1] + 650
                // }
            // })
            .style("top", d => yScale(d.timestamp ))
            // .style("top", (d,i) => {
            //     if(i>0 && d.timestamp <= (data['documentation'][i-1].timestamp + 60 * 120)){
            //         console.log("doc" + data['documentation'][i-1].timestamp)
            //         return yScale(d.timestamp ) + document.getElementById("doc" + data['documentation'][i-1].timestamp).getBoundingClientRect().height;
            //     }
            //     else {
            //         return yScale(d.timestamp )
            //     }
            // })
            .on("mouseover", d => {
                let idName = "doc" + d.timestamp.toString()
                let documentation = document.getElementById(idName)
                documentation.parentNode.appendChild(documentation);
            })
    let docLines = chartSVG.append("g")
        .selectAll("line")
        .data(data['documentation'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("line")
            .attr("x1", xScale(0))
            .attr("x2", xScale.range()[1] + 650)
            .attr("y1", d => yScale(d.timestamp ))
            .attr("y2", d => yScale(d.timestamp ))
            .attr("class", "documentation docLine")
    let docPTS = chartSVG.append("g")
        .selectAll("circle")
        .data(data['documentation'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
        .enter()
        .append("circle")
            .attr("class", "documentation docPTS")
            .attr("cx", xScale(0))
            .attr("cy", d => yScale(d.timestamp ))
            .attr("r", 3)

    let lineChoice = document.getElementById("filterBy");

    lineChoice.oninput = (event) => {
        let selected = d3.selectAll("." + event.target.value)
        let toggle = event.target.checked
        selected.classed("hide", !toggle)
        }
    
    let nextDayButton = document.getElementById("nextDay")
    let prevDayButton = document.getElementById("prevDay")

    nextDayButton.onclick = (event) => {
        if(nullIndex >= nullItems.length - 1){
            nextDayButton.style.opacity = 0.2
        }
        else{
            nullIndex += 1
            prevDayButton.style.opacity = 1
            console.log(nullIndex)
            console.log(currentPredictions)
            currentPredictions = data.predictions.slice(nullItems[nullIndex], (nullItems[nullIndex + 1] + 1))
            update(currentPredictions)
        }
    }
    
    prevDayButton.onclick = (event) => {
        if(nullIndex < 0){
            prevDayButton.style.opacity = 0.2
        }
        else{
            nullIndex -= 1
            nextDayButton.style.opacity = 1
            console.log(nullIndex)
            console.log(currentPredictions)
            currentPredictions = data.predictions.slice(nullItems[nullIndex], (nullItems[nullIndex + 1] + 1))
            update(currentPredictions)
        }
    }

    function update(currentPredictions){
        console.log(currentPredictions)
        console.log(currentPredictions[1]['timestamp'], currentPredictions[currentPredictions.length - 2]['timestamp'])

        var t = d3.transition()
            .duration(500)
            .ease(d3.easeLinear);

        yScale.domain([currentPredictions[1]['timestamp'], currentPredictions[currentPredictions.length - 2]['timestamp']])
        d3.select('.yAxis')
            .transition(t)
            .call(d3.axisLeft(yScale));

        deltasArray.forEach(variable => {
            const line = d3.line()
                .defined(d => d['mean_deltas'][variable] !== null)
                .x(d => xScale(d['mean_deltas'][variable]))
                .y(d => yScale(d.timestamp))
            d3.select(".predLine." + variable.replace("_mean_delta", ""))
                .datum(currentPredictions)
                .transition(t)
                .attr("d", line)
        })
        let interventionData = data['interventions'].filter(d => d.timestamp > currentPredictions[1]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp'])
        console.log(interventionData)

        d3.selectAll(".deets").remove()
        interventionLines.remove()
        interventionLines = chartSVG.append("g")
            .selectAll("line")
            .data(interventionData)
            .enter().append("line")
                .attr("x1", d => xScale(d['mean_delta']))
                .attr("x2", xScale.range()[1] + 100)
                .attr("y1", d => yScale(d.timestamp))
                .attr("y2", d => yScale(d.timestamp))
                .attr("class", d => d.marker + " interventions interventionLine")

        interventionPTS.remove()
        interventionPTS = chartSVG.append("g")
            .selectAll("circle")
            .data(interventionData)
            .enter().append("circle")
                .attr("class", d => "interventions interventionPTS " + d.marker)
                .attr("cx", d => xScale(d['mean_delta']))
                .attr("cy", d => yScale(d.timestamp))
                .attr("r", 3)

        interventionText.remove()
        interventionText = chartSVG.append("g")
        .selectAll("text")
        .data(interventionData)
        .enter()
        .append("text")
            .attr("class", d => "interventions interventionTXT " + d.marker)
            .attr("id", d => "text" + d.timestamp)
            .attr("x", xScale.range()[1]+ 104)
            .attr("y", d => yScale(d.timestamp))
            .text(d => d.content)
        .on("click", d => {
            let idName = "intervention" + d.timestamp.toString().split(".")[0]
            if(document.getElementById(idName)){
                let deet = d3.select("#" + idName)
                if(deet.style("display") == "none"){
                    deet.style("display", "block")
                }
                else{
                    deet.style("display", "none")
                }
            }
            else{
                d3.select("#chart").append("div")
                    .html("<p><b>Marker: </b>" + d.marker + "<br>" + "<p><b>Intervention: </b>" + d.intervention + "<br>" + "<p><b>Content: </b>" + d.content + "</p>")
                    .attr("class", "deets interventions " + d.marker)
                    .attr("id", idName)
                    .style("left", xScale.range()[1]+ 104)
                    .style("top", yScale(d.timestamp ))
                    // .style('left', d3.event.pageX - margin.left - margin.right + 'px')
                    // .style('top', d3.event.pageY - margin.top - margin.bottom + 'px');
            }
        })
    }

})

let cover = document.getElementById('cover')
let gentileschi = document.getElementById('gentileschi')
let intro = document.getElementById('intro')
let chart = document.getElementById('chart')
let chartNav = document.getElementById('chartNav')

window.onscroll = function() {
    if(window.scrollY < cover.getBoundingClientRect().height){
        cover.style.visibility = "visible"
        cover.style.opacity = (cover.getBoundingClientRect().height - window.scrollY) / cover.getBoundingClientRect().height
        gentileschi.style.visibility = "visible"
        gentileschi.style.opacity = 1 - (intro.getBoundingClientRect().height - window.scrollY) / intro.getBoundingClientRect().height
        gentileschi.style.transition = "none"
        gentileschi.style.webkitTransition = "none"
    }
    else if(window.scrollY > cover.getBoundingClientRect().height && intro.getBoundingClientRect().bottom > 0){
        cover.style.visibility = "hidden"
        cover.style.opacity = 0
        gentileschi.style.transition = "opacity 600ms, visibility 600ms"
        gentileschi.style.webkitTransition = "opacity 600ms, visibility 600ms"
        gentileschi.style.visibility = "visible"
        gentileschi.style.opacity = 1
    }

    if(window.scrollY >= intro.getBoundingClientRect().height){
        if (intro.getBoundingClientRect().bottom >= 0){
            gentileschi.style.transition = "none"
            gentileschi.style.webkitTransition = "none"
            gentileschi.style.opacity = intro.getBoundingClientRect().bottom / intro.getBoundingClientRect().height
        }
        else{
            gentileschi.style.transition = "opacity 600ms, visibility 600ms"
            gentileschi.style.webkitTransition = "opacity 600ms, visibility 600ms"
            gentileschi.style.visibility = "hidden"
            gentileschi.style.opacity = 0
            cover.style.visibility = "hidden"
            cover.style.opacity = 0
        }
    }
    // else if(window.scrollY < intro.getBoundingClientRect().top){
    //     intro.style.visibility = "visible"
    //     intro.style.opacity = (intro.getBoundingClientRect().top - window.scrollY) / intro.getBoundingClientRect().top
    // }
    // else if(window.scrollY >= intro.getBoundingClientRect().top){
    //     intro.style.visibility = "hidden"
    //     intro.style.opacity = 0
    // }
    if(chart.getBoundingClientRect().top < 300){
        // chartNav.style.display = "block"
        chartNav.style.visibility = "visible"
        chartNav.style.opacity = 1
    }
    else if(chart.getBoundingClientRect().top > 300){
        // chartNav.style.display = "none"
        chartNav.style.visibility = "hidden"
        chartNav.style.opacity = 0
    }
}