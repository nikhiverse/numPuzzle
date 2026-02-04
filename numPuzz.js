class NumPuzzleGame {
  constructor() {
    this.size = 5;
    this.rangeMode = "normal";
    this.timerMode = "countup";
    this.timeLimit = 5;
    this.elapsedSeconds = 0;
    this.timeLeft = 0;
    this.tiles = [];
    this.winningState = [];
    this.emptyPos = { r: 0, c: 0 };
    this.moves = 0;
    this.expectedMoves = 0;
    this.timerInterval = null;
    this.gameOver = false;
    this.wasmReady = false;

    // Inject CSS for the loader animation
    this.injectStyles();

    // Wait for WASM Module to be ready
    if (typeof Module !== "undefined" && Module.ccall) {
      this.wasmReady = true;
    } else {
      const checkWasm = setInterval(() => {
        if (typeof Module !== "undefined" && Module.ccall && Module._malloc) {
          this.wasmReady = true;
          console.log("WASM Module ready!");
          clearInterval(checkWasm);
        }
      }, 100);
    }

    this.init();
  }

  injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .puzzle-loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 20px auto;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  init() {
    // 1. Radio Logic
    document.querySelectorAll(".radio-option").forEach((option) => {
      option.addEventListener("click", () => {
        const input = option.querySelector('input[type="radio"]');
        input.checked = true;
        const groupName = input.name;

        document
          .querySelectorAll(`input[name="${groupName}"]`)
          .forEach((radio) => {
            radio.closest(".radio-option").classList.remove("selected");
          });
        option.classList.add("selected");

        if (groupName === "timerMode") {
          const timeSection = document.getElementById("time-limit-section");
          if (timeSection) {
            timeSection.style.display =
              input.value === "countdown" ? "block" : "none";
          }
        }
      });
    });

    // 2. Keyboard
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  // --- A* SOLVER INTEGRATION ---
  calculateExpectedMoves() {
    if (
      typeof Module === "undefined" ||
      typeof Module.cwrap !== "function" ||
      typeof Module._malloc !== "function"
    ) {
      console.warn("WASM not ready. Returning 0.");
      return 0;
    }

    try {
      const totalLength = this.tiles.length;
      const byteLength = totalLength * 4;

      const tileArray = this.tiles.map((t) => (t === null ? 0 : t));
      const winArray = this.winningState.map((t) => (t === null ? 0 : t));

      const tilePtr = Module._malloc(byteLength);
      const winPtr = Module._malloc(byteLength);

      let wasmBuffer;
      try {
        if (typeof wasmMemory !== "undefined" && wasmMemory.buffer) {
          wasmBuffer = wasmMemory.buffer;
        } else if (typeof Module.HEAPU8 !== "undefined") {
          wasmBuffer = Module.HEAPU8.buffer;
        } else {
          throw new Error("Cannot access WASM memory buffer");
        }
      } catch (e) {
        console.error("Memory access error:", e);
        Module._free(tilePtr);
        Module._free(winPtr);
        return 0;
      }

      const dataView = new DataView(wasmBuffer);
      for (let i = 0; i < totalLength; i++) {
        dataView.setInt32(tilePtr + i * 4, tileArray[i], true);
        dataView.setInt32(winPtr + i * 4, winArray[i], true);
      }

      const maxStates =
        this.size === 4 ? 200000 : this.size === 5 ? 300000 : 500000;
      console.log(`Running A* solver for ${this.size}x${this.size} puzzle...`);

      const optimalMoves = Module.ccall(
        "solveWithAStarLimited",
        "number",
        ["number", "number", "number", "number", "number"],
        [tilePtr, winPtr, this.size, totalLength, maxStates],
      );

      Module._free(tilePtr);
      Module._free(winPtr);

      if (optimalMoves === -1) {
        console.warn(
          "A* solver timeout, falling back to Manhattan distance estimate",
        );
        const tilePtr2 = Module._malloc(byteLength);
        const winPtr2 = Module._malloc(byteLength);
        const dataView2 = new DataView(wasmBuffer);
        for (let i = 0; i < totalLength; i++) {
          dataView2.setInt32(tilePtr2 + i * 4, tileArray[i], true);
          dataView2.setInt32(winPtr2 + i * 4, winArray[i], true);
        }
        const estimate = Module.ccall(
          "calculateManhattanDistance",
          "number",
          ["number", "number", "number", "number"],
          [tilePtr2, winPtr2, this.size, totalLength],
        );
        Module._free(tilePtr2);
        Module._free(winPtr2);
        return estimate;
      }

      console.log(`A* found optimal solution: ${optimalMoves} moves`);
      return optimalMoves;
    } catch (error) {
      console.error("A* Solver Failed:", error);
      return 0;
    }
  }

  handleKeyDown(e) {
    if (
      this.gameOver ||
      document.getElementById("game-screen").style.display === "none" ||
      document.getElementById("game-modal")
    )
      return;

    let targetR = this.emptyPos.r;
    let targetC = this.emptyPos.c;

    if (e.key === "ArrowUp") targetR++;
    else if (e.key === "ArrowDown") targetR--;
    else if (e.key === "ArrowLeft") targetC++;
    else if (e.key === "ArrowRight") targetC--;
    else return;

    if (
      targetR >= 0 &&
      targetR < this.size &&
      targetC >= 0 &&
      targetC < this.size
    ) {
      this.handleTileClick(targetR, targetC);
    }
  }

  startGame() {
    if (!this.wasmReady) {
      alert("Please wait, loading solver module...");
      return;
    }

    this.showModal("loading");

    setTimeout(() => {
      this.size = parseInt(
        document.querySelector('input[name="gridSize"]:checked').value,
      );
      this.rangeMode = document.querySelector(
        'input[name="rangeMode"]:checked',
      ).value;
      this.timerMode = document.querySelector(
        'input[name="timerMode"]:checked',
      ).value;
      this.timeLimit =
        parseInt(document.getElementById("time-limit").value) || 5;

      document.getElementById("size-display").textContent =
        `${this.size}x${this.size}`;
      document.getElementById("range-display").textContent =
        this.rangeMode === "normal" ? "Normal" : "Expand";

      document.getElementById("setup-screen").style.display = "none";
      document.getElementById("game-screen").style.display = "block";

      this.resetGame();
    }, 100);
  }

  resetGame() {
    this.moves = 0;
    this.elapsedSeconds = 0;
    this.gameOver = false;
    this.updateMoves();

    try {
      this.generateSolvableBoard();

      this.expectedMoves = this.calculateExpectedMoves();

      const expectedDisplay = document.getElementById("expected-moves-display");
      if (expectedDisplay) {
        expectedDisplay.textContent = this.expectedMoves;
      }
      console.log("Optimal Moves:", this.expectedMoves);

      this.renderBoard();
      this.startTimer();
    } catch (e) {
      console.error("Error generating game:", e);
      alert("Something went wrong creating the puzzle.");
    } finally {
      this.closeModal();
    }
  }

  generateSolvableBoard() {
    const totalTiles = this.size * this.size;
    const numCount = totalTiles - 1;
    let nums = [];

    if (this.rangeMode === "normal") {
      nums = Array.from({ length: numCount }, (_, i) => i + 1);
    } else {
      let maxRange;
      if (this.size === 4) maxRange = 30;
      else if (this.size === 5) maxRange = 48;
      else if (this.size === 6) maxRange = 70;
      else maxRange = numCount * 2;

      const pool = Array.from({ length: maxRange }, (_, i) => i + 1);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      nums = pool.slice(0, numCount);
      nums.sort((a, b) => a - b);
    }

    this.winningState = [...nums, null];
    this.tiles = [...this.winningState];
    this.emptyPos = { r: this.size - 1, c: this.size - 1 };

    for (let i = 0; i < 1000; i++) {
      const neighbors = this.getNeighbors(this.emptyPos);
      const move = neighbors[Math.floor(Math.random() * neighbors.length)];
      this.swap(this.emptyPos, move);
      this.emptyPos = move;
    }
  }

  getNeighbors(pos) {
    const neighbors = [];
    if (pos.r > 0) neighbors.push({ r: pos.r - 1, c: pos.c });
    if (pos.r < this.size - 1) neighbors.push({ r: pos.r + 1, c: pos.c });
    if (pos.c > 0) neighbors.push({ r: pos.r, c: pos.c - 1 });
    if (pos.c < this.size - 1) neighbors.push({ r: pos.r, c: pos.c + 1 });
    return neighbors;
  }

  swap(p1, p2) {
    const idx1 = p1.r * this.size + p1.c;
    const idx2 = p2.r * this.size + p2.c;
    [this.tiles[idx1], this.tiles[idx2]] = [this.tiles[idx2], this.tiles[idx1]];
  }

  renderBoard() {
    const container = document.getElementById("square-container");
    container.innerHTML = "";
    container.style.display = "grid";
    container.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    container.style.gap = "4px";

    this.tiles.forEach((num, index) => {
      const r = Math.floor(index / this.size);
      const c = index % this.size;

      const btn = document.createElement("button");
      btn.className = "square-btn";
      if (num === null) {
        btn.style.visibility = "hidden";
      } else {
        btn.textContent = num;
        btn.onclick = () => this.handleTileClick(r, c);
      }
      container.appendChild(btn);
    });
  }

  handleTileClick(r, c) {
    if (this.gameOver) return;

    const isAdjacent =
      (Math.abs(r - this.emptyPos.r) === 1 && c === this.emptyPos.c) ||
      (Math.abs(c - this.emptyPos.c) === 1 && r === this.emptyPos.r);

    if (isAdjacent) {
      this.swap({ r, c }, this.emptyPos);
      this.emptyPos = { r, c };
      this.moves++;
      this.updateMoves();
      this.renderBoard();
      this.checkWin();
    }
  }

  updateMoves() {
    document.getElementById("moves").textContent = `Moves: ${this.moves}`;
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const watchDisplay = document.getElementById("watch");
    if (this.timerMode === "countdown") {
      this.timeLeft = this.timeLimit * 60;
      watchDisplay.textContent = this.formatTime(this.timeLeft);
    } else {
      this.elapsedSeconds = 0;
      watchDisplay.textContent = "00:00";
    }

    this.timerInterval = setInterval(() => {
      if (this.timerMode === "countdown") {
        this.timeLeft--;
        watchDisplay.textContent = this.formatTime(this.timeLeft);

        // MODIFIED: Fix for premature "Time Up"
        if (this.timeLeft <= 0) {
          // 1. Stop everything immediately
          clearInterval(this.timerInterval);
          this.gameOver = true;

          // 2. Wait 500ms so user sees "00:00" before modal
          setTimeout(() => this.endGame(false), 500);
        }
      } else {
        this.elapsedSeconds++;
        watchDisplay.textContent = this.formatTime(this.elapsedSeconds);
      }
    }, 1000);
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  checkWin() {
    const isWin = this.tiles.every((val, i) => val === this.winningState[i]);
    if (isWin) {
      // MODIFIED: Fix for premature "Win Modal"
      // 1. Freeze game state immediately
      this.gameOver = true;
      clearInterval(this.timerInterval);

      // 2. Wait 300ms so the last tile has time to render visually
      setTimeout(() => this.endGame(true), 300);
    }
  }

  endGame(win) {
    // Ensure cleanup happens (just in case)
    this.gameOver = true;
    clearInterval(this.timerInterval);

    if (win) {
      let stars = 1;
      if (this.moves <= this.expectedMoves * 1.1) stars = 3;
      else if (this.moves <= this.expectedMoves * 1.6) stars = 2;
      else if (this.moves > this.expectedMoves * 1.6) stars = 1;

      const starStr = "⭐".repeat(stars);

      let timeStr = "";
      if (this.timerMode === "countdown") {
        const used = this.timeLimit * 60 - this.timeLeft;
        timeStr = this.formatTime(used);
      } else {
        timeStr = this.formatTime(this.elapsedSeconds);
      }

      this.showModal("win", {
        stars: starStr,
        moves: this.moves,
        expected: this.expectedMoves,
        time: timeStr,
      });
    } else {
      this.showModal("timeout", {
        moves: this.moves,
      });
    }
  }

  backToSetup() {
    if (!this.gameOver) {
      this.showModal("confirmExit");
    } else {
      this.confirmBackToSetup();
    }
  }

  confirmBackToSetup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    document.getElementById("setup-screen").style.display = "block";
    document.getElementById("game-screen").style.display = "none";
    this.closeModal();
    this.gameOver = false;
  }

  showModal(type, data = {}) {
    this.closeModal(); // Close any existing modal

    const modal = document.createElement("div");
    modal.id = "game-modal";

    if (type === "loading") {
      modal.innerHTML = `
        <div class="modal-content">
          <h2>Creating Puzzle...</h2>
          <div class="puzzle-loader"></div>
          <p>Analyzing optimal solution.</p>
          <p style="font-size: 0.8em; color: #777;">This may take a few seconds.</p>
        </div>
      `;
    } else if (type === "win") {
      let optimumMsg = `Optimum: ${data.expected}`;
      if (data.moves <= data.expected * 1.1) {
        optimumMsg += " (Perfect!)";
      }

      modal.innerHTML = `
            <div class="modal-content">
              <h2>🎉 Puzzle Solved!</h2>
              <p>Great job rearranging the tiles!</p>
              <div class="modal-stats">
                <div>📏 Size: <strong>${this.size}x${this.size}</strong></div>
                <div>📊 Rating: <strong style="color: #ffd700;">${data.stars}</strong></div>
                <div>⏱️ Time: <strong>${data.time}</strong></div>
                <div>👣 Moves: <strong>${data.moves}</strong></div>
                <div style="font-size: 0.9em; color: #666; margin-top: 5px;">${optimumMsg}</div>
              </div>
              <button class="modal-btn" onclick="game.confirmBackToSetup();">
                Main Menu
              </button>
            </div>
          `;
    } else if (type === "timeout") {
      modal.innerHTML = `
            <div class="modal-content">
              <h2>⏳ Time's Up!</h2>
              <p>You ran out of time.</p>
              <div class="modal-stats">
                <div>👣 Moves Made: <strong>${data.moves}</strong></div>
                <div>📏 Size: <strong>${this.size}x${this.size}</strong></div>
              </div>
              <button class="modal-btn" onclick="game.confirmBackToSetup();">
                Try Again
              </button>
            </div>
          `;
    } else if (type === "confirmExit") {
      modal.innerHTML = `
        <div class="modal-content">
          <h2>⚠️ Quit Game?</h2>
          <p>Are you sure you want to go back to the main menu? Your current progress will be lost.</p>
          <div class="modal-buttons" style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button class="modal-btn" style="background: #ef5350;" onclick="game.confirmBackToSetup();">
              Yes!
            </button>
            <button class="modal-btn" onclick="game.closeModal();">
              No
            </button>
          </div>
        </div>
    `;
    }

    document.body.appendChild(modal);
  }

  closeModal() {
    const modal = document.getElementById("game-modal");
    if (modal) {
      modal.remove();
    }
  }
}

// Start Game Instance
const game = new NumPuzzleGame();

// Prevent accidental reloads
window.addEventListener("beforeunload", (event) => {
  const gameScreen = document.getElementById("game-screen");
  if (gameScreen && gameScreen.style.display === "block" && !game.gameOver) {
    event.preventDefault();
    event.returnValue = "";
  }
});
