async function getData(){
    let data = await d3.json("./data/db_data.json")
    let documentation = await d3.json("./data/doc_data.json")
    data['documentation'] = documentation

    let danceTracks = await d3.json("./data/exercises.json")
    data['lookup'] = {}
    data['lookup']['danceTracks'] = danceTracks['danceTracks']

    let scriptLookup = await d3.json("./data/script_lookup.json")
    data['lookup']['scripts'] = scriptLookup

    let gratitudeLog = await d3.json("./data/gratitude.json")

    gratitudeLog.forEach(d => {
        d.gratitude_entries.forEach(entry => {
            data.documentation.push(entry)
        })
    })
    return data
}

getData().then(function(data){

    let databases = Object.keys(data)
    databases.splice( Object.keys(data).indexOf('lookup'), 1 )
    databases.forEach(key => {
        data[key] = data[key].filter(d => d.timestamp > 1555164021 && d.timestamp < 1556965804)
        data[key] = data[key].map(d =>{d.timestamp = d.timestamp * 1000; return d})
        data[key] = data[key].reverse()
    })
    
    console.log(data)

    let nullItems = []
    data.predictions.forEach((d,i,obj) => {
        d['mean_deltas'] = {}

        if (d.timestamp !== null && i < (obj.length -1) && d.timestamp > (data['predictions'][i+1].timestamp + 60 * 60 * 5 * 1000)){
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

    let nullIndex = 0
    let currentPredictions = data.predictions.slice(0, nullItems[nullIndex] + 1)
    // console.log(currentPredictions)

    let margin = {top:30, right:50, bottom:60, left: 70};
    let width = window.innerWidth * 0.8;
    let height = currentPredictions.length * 100;
    let axisWidth = width * 0.22

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

    deltasArray.forEach(variable => {
        const line = d3.line()
            .defined(d => d['mean_deltas'][variable] !== null)
            .x(d => xScale(d['mean_deltas'][variable]))
            .y(d => yScale(d.timestamp))
        // const area = d3.area()
        //     .defined(d => d[variable] !== null)
        //     .x1(d => xScale(d[variable]))
        //     .y(d => yScale(d.timestamp))
        //     .x0(xScale(0))
        chartSVG.append("path")
            .datum(currentPredictions)
            .attr("class", "predLine prediction " + variable.replace("_mean_delta", ""))
            .attr("d", line)
    })


    // let gratitudeLines = chartSVG.selectAll("g")
    //     .data(data['gratitudeLog'].filter(d => d.timestamp > currentPredictions[0]['timestamp'] && d.timestamp < currentPredictions[currentPredictions.length - 2]['timestamp']))
    //     .enter()
    //     .append("g")
    //     .selectAll("line")
    //         .data(d => d.gratutde_entries)
    //         .enter()
    //         .append("line")
    //             .attr("x1", xScale(0))
    //             .attr("x2", xScale.range()[1] + 650)
    //             .attr("y1", d => yScale(d.timestamp ))
    //             .attr("y2", d => yScale(d.timestamp ))
    //             .attr("class", "documentation docLine")

    update(currentPredictions)

    let lineChoice = document.getElementById("filterBy");

    lineChoice.oninput = (event) => {
        let selected = d3.selectAll("." + event.target.value)
        let toggle = event.target.checked
        selected.classed("hide", !toggle)
        }
    
    let nextDayButton = document.getElementById("nextDay")
    nextDayButton.style.opacity = 0.2
    let prevDayButton = document.getElementById("prevDay")
    let prevDayCaption = document.getElementById("prevDayCaption")
    let nextDayCaption = document.getElementById("nextDayCaption")

    prevDayButton.onmouseover = (event) => {
        prevDayCaption.style.display = "block"
    }
    prevDayButton.onmouseout = (event) => {
        prevDayCaption.style.display = "none"
    }

    prevDayButton.onclick = (event) => {

        if(nullIndex >= nullItems.length - 1){
            prevDayButton.style.opacity = 0.2
        }
        else{
            nextDayButton.style.opacity = 1
            currentPredictions = data.predictions.slice(nullItems[nullIndex], (nullItems[nullIndex + 1] + 1))
            console.log(nullIndex, nullIndex+1)
            // console.log(nullItems[nullIndex], (nullItems[nullIndex + 1] + 1))
            nullIndex += 1

            if(currentPredictions.length < 4){
                currentPredictions = data.predictions.slice(nullItems[nullIndex + 1], (nullItems[nullIndex + 2] + 1))
                console.log(nullIndex +1, nullIndex+2)
                // console.log(nullItems[nullIndex + 1], (nullItems[nullIndex + 2] + 1))

                nullIndex += 2
            }
            update(currentPredictions)
        }
    }

    nextDayButton.onmouseover = (event) => {
        nextDayCaption.style.display = "block"
    }
    nextDayButton.onmouseout = (event) => {
        nextDayCaption.style.display = "none"
    }

    nextDayButton.onclick = (event) => {
        nullIndex -= 1

        if(nullIndex == 0){
            currentPredictions = data.predictions.slice(0, (nullItems[0] + 1))
            nextDayButton.style.opacity = 0.2
        }
        else{
            prevDayButton.style.opacity = 1

            currentPredictions = data.predictions.slice(nullItems[nullIndex-1], (nullItems[nullIndex] + 1))
            console.log(nullIndex-1, nullIndex)
            // console.log(nullItems[nullIndex], (nullItems[nullIndex + 1] + 1))

            if(currentPredictions.length < 4){
                nullIndex -= 1

                currentPredictions = data.predictions.slice(nullItems[nullIndex - 1], (nullItems[nullIndex] + 1))
                console.log(nullIndex-1, nullIndex)
                // console.log(nullItems[nullIndex - 1], (nullItems[nullIndex] + 1))
            }
        }
        update(currentPredictions)

    }

    function update(currentPredictions){

        // console.log(currentPredictions)
        // console.log(currentPredictions[1]['timestamp'], currentPredictions[currentPredictions.length - 2]['timestamp'])

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
            // let predLine = chartSVG.selectAll(".predLine." + variable.replace("_mean_delta", ""))
            //     .datum(currentPredictions)
            // predLine.exit().remove()
            // predLine.enter().append("path")
            //     .transition(t)
            //     .attr("d", line)
        })
 
        let interventionData = data['interventions'].filter(d => d.timestamp < currentPredictions[1]['timestamp'] && d.timestamp > currentPredictions[currentPredictions.length - 2]['timestamp'])
        console.log(interventionData)

        d3.selectAll(".deets").remove()

        let interventionLines = chartSVG.selectAll(".interventionLine")
            .data(interventionData)
        interventionLines.exit().remove()
        interventionLines.enter().append("line")
            .merge(interventionLines)
                .transition(t)
                .attr("x1", d => xScale(d['mean_delta']))
                .attr("x2", xScale.range()[1] + 200)
                .attr("y1", d => yScale(d.timestamp))
                .attr("y2", d => yScale(d.timestamp))
                .attr("class", d => d.marker + " interventions interventionLine")

        let interventionPTS = chartSVG.selectAll(".interventionPTS")
            .data(interventionData)
        interventionPTS.exit().remove()
        interventionPTS.enter().append("circle")
            .attr("r", 3.5)
            .merge(interventionPTS)
                .transition(t)
                .attr("class", d => "interventions interventionPTS " + d.marker)
                .attr("cx", d => xScale(d['mean_delta']))
                .attr("cy", d => yScale(d.timestamp))

        let interventionTXT = chartSVG.selectAll(".interventionTXT")
            .data(interventionData)
        interventionTXT.exit().remove()
        interventionTXT.enter().append("text")
            .on("click", d => {
                let idName = "intervention" + d.timestamp.toString().split(".")[0]
                        
                if(document.getElementById(idName)){
                    let deet = d3.select("#" + idName)
                    let deetLine = d3.select("#" + idName + "_line")
                    var totalLength = deetLine.node().getTotalLength();

                    if(deet.style("display") == "none"){
                        deetLine.style("stroke-width", 1.5)
                        deetLine
                            .attr("stroke-dasharray", totalLength + " " + totalLength)
                            .attr("stroke-dashoffset", totalLength)
                            .transition(t)
                            .attr("stroke-dashoffset", 0)
                            .on("end", function (d) {
                                deetLine.attr("stroke-dasharray", 2)
                                deet.style("display", "block")
                            })
                    }
                    else{
                        deet.style("display", "none")
                        deetLine.style("stroke-width", 0)
                    }
                }
                else{
                    let newDeet = d3.select("#chart").append("div")
                        .html("<p><b>Marker: </b>" + d.marker + "<br>" + "<p><b>Intervention: </b>" + d.intervention + "<br>" + "<p><b>Content: </b>" + d.content + "</p>")
                        .attr("class", "deets interventions " + d.marker)
                        .attr("id", idName)
                        .style("left", xScale.range()[1]+ 800)
                        .style("top", yScale(d.timestamp))
                        .style("display", "none")
                        
                    let deetLine = chartSVG.append("line")
                        .attr("x1", document.getElementById("text" + d.timestamp).getBoundingClientRect().right + 5)
                        .attr("x2", xScale.range()[1] + 800)
                        .attr("y1", yScale(d.timestamp ))
                        .attr("y2", yScale(d.timestamp ))
                        .attr("class", "documentation deetLine interventions " + d.marker)
                        .attr("id", idName + "_line")
                    var totalLength = deetLine.node().getTotalLength();

                    deetLine
                          .attr("stroke-dasharray", totalLength + " " + totalLength)
                          .attr("stroke-dashoffset", totalLength)
                          .transition(t)
                          .attr("stroke-dashoffset", 0)
                          .on("end", function () {
                              newDeet.style("display", "block")
                              deetLine.attr("stroke-dasharray", 2)
                            })

                    if(d.intervention == "videos"){
                        let link;
                        if(d.content.includes("&")){
                            link = d.content.slice(0, d.content.indexOf("&"))
                        }
                        else{
                            link = d.content
                        }
                        newDeet.html("<p><b>Marker: </b>" + d.marker + "</p><p><b>Intervention: </b>" + d.intervention + "</p><p><b>Timestamp: </b>" + d.timestamp + "</p><p><b>Content: </b>" + "<iframe width='350' height='200' src='" + link.replace("watch?v=", "embed/") + "'></iframe>")
                    }
                    else if(d.intervention == "cuteThings"){
                        newDeet.html("<p><b>Marker: </b>" + d.marker + "</p><p><b>Intervention: </b>" + d.intervention + "</p><p><b>Timestamp: </b>" + d.timestamp + "</p><p><b>Content: </b>" + "<img width='350' src='" + d.content+ "'>")
                    }
                    else if(d.intervention == "fieldTrip"){
                        newDeet.html("<p><b>Marker: </b>" + d.marker + "</p><p><b>Intervention: </b>" + d.intervention + "</p><p><b>Timestamp: </b>" + d.timestamp + "<p><b>Content: </b><br><iframe width='350' height='300' frameborder='0' style='border:0' src='" + "https://www.google.com/maps/embed/v1/place?key=AIzaSyCidl2VEMJ6et1L-eOTFwtIfPPp4zvMfDw&q=" + d.content.slice(48,d.content.length) + "' allowfullscreen></iframe>")
                    }
                    else if(d.marker == "fatigue" || d.marker == "stress" && d.intervention == "exercises"){
                        data['lookup']['danceTracks'].forEach(track => {
                            try{
                                if(track.title == d.content){
                                    newDeet.html("<p><b>Marker: </b>" + d.marker + "</p><p><b>Intervention: </b>" + d.intervention + "</p><p><b>Timestamp: </b>" + d.timestamp + "<p><b>Content: </b>" + "<iframe src='" + track.link.slice(0,25) + "embed/" + track.link.slice(25,track.link.length) + "' width='350' height='85' frameborder='0' allowtransparency='true' allow='encrypted-media'></iframe>" + "</p>")
                                }
                            }
                            catch{
                                newDeet.html("<p><b>Marker: </b>" + d.marker + "</p><p><b>Intervention: </b>" + d.intervention + "</p><p><b>Timestamp: </b>" + d.timestamp + "<p><b>Content: </b>" + d.content + "</p>")
                            }

                        })
                    }
                }
            })
            .merge(interventionTXT)
                .transition(t)
                .attr("class", d => "interventions interventionTXT " + d.marker)
                .attr("id", d => "text" + d.timestamp)
                .attr("x", xScale.range()[1]+ 205)
                .attr("y", d => yScale(d.timestamp))
                .text(d => {
                    let script = data['lookup']['scripts'][d.marker][d.intervention]
                    if(typeof script !== "string"){
                        if(d.content.includes("Workout") || d.content.includes("yoga")){
                            script = data['lookup']['scripts'][d.marker][d.intervention]['workouts']
                        }
                        else if(d.content.includes("sleep")){
                            script = "Hey Jenna, you should go to sleep."
                        }
                        else if(d.content.includes("-")){
                            script = data['lookup']['scripts'][d.marker][d.intervention]['danceTracks'] + d.content.slice(d.content.indexOf("-")+1, d.content.length) + "!"
                        }
                        else if(d.content.includes("question")){
                            script = data['lookup']['scripts'][d.marker][d.intervention]['question']
                        }
                        else if(d.content.includes("joke")){
                            script = data['lookup']['scripts'][d.marker][d.intervention]['joke']
                        }
                        else if (d.content.includes("compliment")){
                            script = data['lookup']['scripts'][d.marker][d.intervention]['compliment']
                        }
                        else{
                            script = "Hey Jenna, " + d.content.toLowerCase()
                        }
                    }
                    else if(d.intervention == "poetry"){
                        let info = d.content.split(" ")
                        let author = info.slice(info.indexOf("by") + 1, info.length)
                        script = script + "by " + author.reduce(function(acc,val){return acc + " " + val}) + "."
                    }
                    return script
                })

        let ritualData = data['rituals'].filter(d => d.timestamp < currentPredictions[1]['timestamp'] && d.timestamp > currentPredictions[currentPredictions.length - 2]['timestamp'])
        
        let ritualLines = chartSVG.selectAll(".ritualLine")
            .data(ritualData.filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness"))
        ritualLines.exit().remove()
        ritualLines.enter().append("line")
            .merge(ritualLines)
                .transition(t)
                .attr("x1", xScale(0))
                .attr("x2", xScale.range()[1] + 200)
                .attr("y1", d => yScale(d.timestamp ))
                .attr("y2", d => yScale(d.timestamp ))
                .attr("class", "rituals ritualLine")

        let ritualPTS = chartSVG.selectAll(".ritualPTS")
            .data(ritualData.filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness"))
        ritualPTS.exit().remove()
        ritualPTS.enter().append("circle")
            .attr("r", 2.5)
            .merge(ritualPTS)
                .attr("class","rituals ritualPTS")
                .attr("cx", xScale(0))
                .attr("cy", d => yScale(d.timestamp ))

        let ritualText = chartSVG.selectAll(".ritualTXT")
            .data(ritualData.filter(d => d.ritual !== "random joke" && d.ritual !== "random mindfulness"))
        ritualText.exit().remove()
        ritualText.enter().append("text")
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
                        .style("left", xScale.range()[1]+ 200)
                        .style("top", yScale(d.timestamp ))
                }
            })
        .merge(ritualText)
            .transition(t)
            .attr("class", "rituals ritualTXT")
            .attr("x", xScale.range()[1]+ 205)
            .attr("y", d => yScale(d.timestamp ))
            .text(d => "Hey Jenna, " + d.content.toLowerCase())

        d3.selectAll(".documentation").remove()

        let docData = data['documentation'].filter(d => (d.timestamp < (currentPredictions[1]['timestamp'] + 60 * 60 * 3 * 1000)) && d.timestamp > currentPredictions[currentPredictions.length - 2]['timestamp'])
    
        let documentation = d3.select("#chart")
            .selectAll("div")
            .data(docData)
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
                .style("left", xScale.range()[1] + 800)
    
                .style("top", d => yScale(d.timestamp ))
                .on("mouseover", d => {
                    let idName = "doc" + d.timestamp.toString()
                    let documentation = document.getElementById(idName)
                    documentation.parentNode.appendChild(documentation);
                })
        let docLines = chartSVG.append("g")
            .selectAll("line")
            .data(docData)
            .enter()
            .append("line")
                .attr("x1", xScale(0))
                .attr("x2", xScale.range()[1] + 900)
                .attr("y1", d => yScale(d.timestamp ))
                .attr("y2", d => yScale(d.timestamp ))
                .attr("class", "documentation docLine stress")
        // let docPTS = chartSVG.append("g")
        //     .selectAll("circle")
        //     .data(docData)
        //     .enter()
        //     .append("circle")
        //         .attr("class", "documentation docPTS")
        //         .attr("cx", xScale(0))
        //         .attr("cy", d => yScale(d.timestamp ))
        //         .attr("r", 3.5)
    }
})

let cover = document.getElementById('cover')
let gentileschi = document.getElementById('gentileschi')
let intro = document.getElementById('intro')
let chart = document.getElementById('chart')
let chartNav = document.getElementById('chartNav')
let captionContainer = document.getElementById('caption-container')
let caption = document.getElementById('caption')
caption.style.display = "none"
caption.innerHTML = "Style-transferred from <i><a href='https://en.wikipedia.org/wiki/Self-Portrait_as_the_Allegory_of_Painting' target='new'>Self-Portrait as the Allegory of Painting</a></i> using <a href='https://github.com/lengstrom/fast-style-transfer' target='new'>Fast Style Transfer</a>"

captionContainer.onclick = function() {
    if(caption.style.display == "none"){
        caption.style.display = "block"
    }
    else{
        caption.style.display = "none"
    }
}
// let border = document.getElementById('border-fullScreen')

window.onscroll = function() {
    if(window.scrollY < cover.getBoundingClientRect().height){
        cover.style.visibility = "visible"
        cover.style.opacity = (cover.getBoundingClientRect().height - window.scrollY) / cover.getBoundingClientRect().height
        gentileschi.style.visibility = "visible"
        gentileschi.style.opacity = 1 - (intro.getBoundingClientRect().height - window.scrollY) / intro.getBoundingClientRect().height
        gentileschi.style.transition = "none"
        gentileschi.style.webkitTransition = "none"
        caption.innerHTML = "Style-transferred from <i><a href='https://en.wikipedia.org/wiki/Self-Portrait_as_the_Allegory_of_Painting' target='new'>Self-Portrait as the Allegory of Painting</a></i> using <a href='https://github.com/lengstrom/fast-style-transfer' target='new'>Fast Style Transfer</a>"
    }
    else if(window.scrollY > cover.getBoundingClientRect().height && intro.getBoundingClientRect().bottom > 0){
        cover.style.visibility = "hidden"
        cover.style.opacity = 0
        gentileschi.style.transition = "opacity 600ms, visibility 600ms"
        gentileschi.style.webkitTransition = "opacity 600ms, visibility 600ms"
        gentileschi.style.visibility = "visible"
        gentileschi.style.opacity = 1
        captionContainer.style.display = "block"
        caption.innerHTML = "<i><a href='https://en.wikipedia.org/wiki/Self-Portrait_as_the_Allegory_of_Painting' target='new'>Self-Portrait as the Allegory of Painting</a></i> by Artemisia Gentileschi, 1638–39"
    }

    if(window.scrollY >= intro.getBoundingClientRect().height){
        if (intro.getBoundingClientRect().bottom >= 0){
            gentileschi.style.transition = "none"
            gentileschi.style.webkitTransition = "none"
            gentileschi.style.opacity = intro.getBoundingClientRect().bottom / intro.getBoundingClientRect().height
        }
        else{
            captionContainer.style.display = "none"
            gentileschi.style.transition = "opacity 600ms, visibility 600ms"
            gentileschi.style.webkitTransition = "opacity 600ms, visibility 600ms"
            gentileschi.style.visibility = "hidden"
            gentileschi.style.opacity = 0
            cover.style.visibility = "hidden"
            cover.style.opacity = 0
            // border.style.position = "fixed"
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