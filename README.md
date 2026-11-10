# DerivNova Analyzer

A Manifest V3 Chrome extension for live public Deriv market analysis. The project includes a Chrome side panel, separate resizable floating window, popup launcher, Deriv-page launcher, dynamic market discovery, digit analysis, indicators, a market scanner and live charts.

## Install

1. Download and extract the repository.
2. Visit `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the extracted repository folder.
4. Open Deriv. Use the extension toolbar button to open the side panel or floating window, then choose **Connect**.

## Features

- Dynamic active-market discovery, searchable by market and category; categories are derived from returned Deriv symbol information.
- History windows of 50, 100, 250, 500, 1,000, 2,000 and 5,000 ticks.
- D-Circle with tied hot/cold digit detection, frequency percentages and latest-digit marking. Hot/cold labels wait for 20 observations.
- Even/Odd, barrier-selectable Over/Under, and target-selectable Matches/Differs counts, percentages and expandable recent history.
- RSI, MACD, configurable EMA/SMA periods, Bollinger bands, support/resistance, trend, momentum and volatility, with insufficient-data indicators.
- Scanner for currently available index markets, with category and text filters, sorting, quotes, digit distributions and technical summaries.
- Live price and last-digit charts, stale-data status, reconnect behavior, settings storage and optional notifications.
- Separate resizable floating Chrome window and side-panel access. Both views use the same analysis modules and saved market/settings preferences; each open view currently owns its own WebSocket session.

## Market data and privacy

The analyzer connects to Deriv's public market-data WebSocket endpoint, `wss://api.derivws.com/trading/v1/options/ws/public`. This endpoint requires no account login for public market data. The extension does not place trades and does not request passwords or API tokens. It stores only non-sensitive preferences locally.

Optional account OAuth is not enabled: it requires a Deriv OAuth application client ID and an approved redirect URI. No client ID was supplied for this project. Public market analysis works without it.

## Checks

Run `npm test` to check digit extraction, frequency calculations, D-Circle ties, Over/Under and Matches/Differs calculations, categories, indicators and scanner signal thresholds. Validate the extension by loading the folder through Chrome's extension manager. Browser installation testing is not automated by this repository.
