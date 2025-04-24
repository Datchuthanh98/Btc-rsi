const INTERVAL_LABELS = {
    "5m": "M5", "15m": "M15", "1h": "H1", "4h": "H4", "12h": "H12", "1d": "D"
};

document.getElementById("intervalSelect").addEventListener("change", () => {
    const selectedInterval = document.getElementById("intervalSelect").value;
    loadChart(selectedInterval);
});

window.onload = function () {
    if (localStorage.getItem("loggedIn") !== "true") {
        const username = prompt("Tên đăng nhập:");
        const password = prompt("Mật khẩu:");

        if (username === "admin" && password === "abc123") {
            localStorage.setItem("loggedIn", "true");
            alert("Đăng nhập thành công!");
        } else {
            alert("Sai thông tin đăng nhập. Trang sẽ bị khoá.");
            document.body.innerHTML = "<h2 style='color:red'>Bạn không có quyền truy cập.</h2>";
            return;
        }
    }

    loadChart("15m");
};

function logout() {
    localStorage.removeItem("loggedIn");
    location.reload();
}

async function loadChart(interval) {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=500`);
    const rawData = await res.json();

    const closePrices = rawData.map((d, i) => ({ x: i, y: parseFloat(d[4]) }));

    const candlestickData = rawData.map((d, i) => {
        const open = parseFloat(d[1]);
        const high = parseFloat(d[2]);
        const low = parseFloat(d[3]);
        const close = parseFloat(d[4]);
        return {
            x: i,
            y: [open, high, low, close],
            color: close > open ? "green" : "red"
        };
    });

    function calculateRSI(data, period = 14) {
        let result = [];
        let gains = 0, losses = 0;

        for (let i = 1; i <= period; i++) {
            let diff = data[i].y - data[i - 1].y;
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgGain / avgLoss;
        let rsi = 100 - (100 / (1 + rs));
        result.push({ x: data[period].x, y: rsi });

        for (let i = period + 1; i < data.length; i++) {
            let diff = data[i].y - data[i - 1].y;
            if (diff >= 0) {
                avgGain = (avgGain * (period - 1) + diff) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - diff) / period;
            }
            rs = avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
            result.push({ x: data[i].x, y: rsi });
        }
        return result;
    }

    function calculateEMA(sourceData, period) {
        let result = [];
        let multiplier = 2 / (period + 1);
        let emaPrev;

        for (let i = 0; i < sourceData.length; i++) {
            if (i < period) continue;
            if (emaPrev === undefined) {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += sourceData[i - j].y;
                }
                emaPrev = sum / period;
            } else {
                emaPrev = (sourceData[i].y - emaPrev) * multiplier + emaPrev;
            }
            result.push({ x: sourceData[i].x, y: emaPrev });
        }
        return result;
    }

    function calculateSMA(sourceData, period) {
        let result = [];
        for (let i = 0; i < sourceData.length; i++) {
            if (i < period - 1) continue;
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += sourceData[i - j].y;
            }
            result.push({ x: sourceData[i].x, y: sum / period });
        }
        return result;
    }

    function calculateWMA(sourceData, period) {
        let result = [];
        let denominator = (period * (period + 1)) / 2;

        for (let i = 0; i < sourceData.length; i++) {
            if (i < period) continue;
            let weightedSum = 0;
            for (let j = 0; j < period; j++) {
                weightedSum += sourceData[i - j].y * (period - j);
            }
            result.push({ x: sourceData[i].x, y: weightedSum / denominator });
        }
        return result;
    }

    const rsiData = calculateRSI(closePrices, 14);
    const emaRSIData = calculateEMA(rsiData, 9);
    const wmaRSIData = calculateWMA(rsiData, 45);  // WMA45 cho RSI
    const emaPriceData = calculateEMA(closePrices, 9);
    const smaPriceData = calculateSMA(closePrices, 45);  // SMA45 cho giá

    const paddingPoints = 50;
    const lastX = closePrices[closePrices.length - 1].x;

    function addPadding(dataArray) {
        let result = [...dataArray];
        for (let i = 1; i <= paddingPoints; i++) {
            result.push({ x: lastX + i, y: null });
        }
        return result;
    }

    const rsiDataPadded = addPadding(rsiData);
    const emaRSIPadded = addPadding(emaRSIData);
    const wmaRSIPadded = addPadding(wmaRSIData);
    const candlestickDataPadded = addPadding(candlestickData);
    const emaPricePadded = addPadding(emaPriceData);
    const smaPricePadded = addPadding(smaPriceData);  // Padded SMA45 data

    const stockChart = new CanvasJS.StockChart("chartContainer", {
        title: {
            text: `BTC/USDT - ${INTERVAL_LABELS[interval]}`,
            fontSize: 40
        },
        animationEnabled: true,
        exportEnabled: true,
        charts: [
            {
                height: 600,
                axisX: {
                    crosshair: { enabled: true, snapToDataPoint: true },
                    gridColor: "#eeeeee"
                },
                axisY: {
                    title: "Price",
                    prefix: "$",
                    gridColor: "#eeeeee",
                    crosshair: { enabled: true }
                },
                toolTip: { shared: true },
                data: [
                    {
                        type: "candlestick",
                        name: "BTCUSDT",
                        yValueFormatString: "$###0.00",
                        risingColor: "green",
                        fallingColor: "red",
                        showInLegend: true,
                        dataPoints: candlestickDataPadded
                    },
                    {
                        type: "line",
                        name: "EMA 9",
                        color: "blue",
                        lineThickness: 1,
                        showInLegend: true,
                        dataPoints: emaPricePadded
                    },
                    {
                        type: "line",
                        name: "SMA 45",  // SMA45 cho giá
                        color: "orange",
                        lineThickness: 1,
                        showInLegend: true,
                        dataPoints: smaPricePadded
                    }
                ]
            },
            {
                height: 300,
                axisX: {
                    crosshair: { enabled: true, snapToDataPoint: true },
                    gridColor: "#eeeeee"
                },
                axisY: {
                    title: "RSI",
                    minimum: 0,
                    maximum: 100,
                    gridColor: "#eeeeee",
                    stripLines: [
                        { 
                            value: 70, 
                            label: "70", 
                            color: "black", 
                            lineDashType: "dash", 
                            labelFontColor: "black",
                            lineThickness: 3  // Tăng độ dày đường đứt
                        },
                        { 
                            value: 50, 
                            label: "50", 
                            color: "sliver",
                            lineDashType: "dash", 
                            labelFontColor: "black",
                            lineThickness: 3  // Tăng độ dày đường đứt
                        },
                        { 
                            value: 30, 
                            label: "30", 
                            color: "black", 
                            lineDashType: "dash", 
                            labelFontColor: "black",
                            lineThickness: 3  // Tăng độ dày đường đứt
                        },
                        {
                            // Tạo vùng màu nền từ 30 đến 70
                            startValue: 30,
                            endValue: 70,
                            color: "rgba(159, 130, 229, 0.2)", 
                            label: "",
                            lineThickness: 0
                        }
                      
                    ],
                    crosshair: { enabled: true }
                },
                data: [
                    {
                        type: "line",
                        name: "RSI 14",
                        color: "black",  // Màu đen cho đường RSI
                        lineThickness: 1,
                        showInLegend: true,
                        dataPoints: rsiDataPadded
                    },
                    {
                        type: "line",
                        name: "EMA 9 (RSI)",
                        color: "blue",
                        lineThickness: 1,
                        showInLegend: true,
                        dataPoints: emaRSIPadded
                    },
                    {
                        type: "line",
                        name: "WMA 45 (RSI)",  // WMA45 cho RSI
                        color: "orange",
                        lineThickness: 1,
                        showInLegend: true,
                        dataPoints: wmaRSIPadded
                    }
                ]
            }
        ],
        navigator: {
            slider: {
                minimum: closePrices.length - 100,
                maximum: closePrices.length + paddingPoints 
            }
        },
        rangeSelector: {
            inputFields: {
                startValue: closePrices.length - 150,
                endValue: closePrices.length,
                valueFormatString: "###0"
            },
            buttons: [{ label: "All", rangeType: "all" }],
            selectedRangeButtonIndex: 0
        }
    });

    stockChart.render();
}
