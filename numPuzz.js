class NumPuzzleGame {
  constructor() {
    this.size = 5;
    this.sortOrder = "ascending";
    this.timeLimit = 5;
    this.tiles = [];
    this.winningState = [];
    this.emptyPos = { r: 0, c: 0 };
    this.moves = 0;
    this.timerInterval = null;
    this.gameOver = false;

    this.init();
  }

  init() {
    // Reuse the radio button selection logic from your reference code
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
      });
    });

    // Add Keyboard Listener for Arrow Keys
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  handleKeyDown(e) {
    // Only process keys if the game is active
    if (
      this.gameOver ||
      document.getElementById("game-screen").style.display === "none"
    )
      return;

    let targetR = this.emptyPos.r;
    let targetC = this.emptyPos.c;

    /**
     * LOGIC: To slide a box into the vacant space,
     * we must pick the box in the opposite direction of the arrow.
     */
    if (e.key === "ArrowUp")
      targetR++; // Tile below the vacancy moves UP
    else if (e.key === "ArrowDown")
      targetR--; // Tile above the vacancy moves DOWN
    else if (e.key === "ArrowLeft")
      targetC++; // Tile to the right moves LEFT
    else if (e.key === "ArrowRight")
      targetC--; // Tile to the left moves RIGHT
    else return;

    // Boundary check: ensure the target tile exists
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
    this.size = parseInt(
      document.querySelector('input[name="gridSize"]:checked').value,
    );
    this.sortOrder = document.querySelector(
      'input[name="sortOrder"]:checked',
    ).value;
    this.timeLimit = parseInt(document.getElementById("time-limit").value) || 5;

    document.getElementById("size-display").textContent =
      `${this.size}x${this.size}`;
    document.getElementById("sort-display").textContent =
      this.sortOrder.charAt(0).toUpperCase() + this.sortOrder.slice(1);

    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("game-screen").style.display = "block";

    this.resetGame();
  }

  resetGame() {
    this.moves = 0;
    this.gameOver = false;
    this.updateMoves();
    this.generateSolvableBoard();
    this.renderBoard();
    this.startTimer();
  }

  generateSolvableBoard() {
    const totalTiles = this.size * this.size;
    let nums = Array.from({ length: totalTiles - 1 }, (_, i) => i + 1);

    if (this.sortOrder === "descending") {
      nums.reverse();
    }

    this.winningState = [...nums, null]; // null represents the vacancy
    this.tiles = [...this.winningState];

    // Shuffle by making 1000 valid moves from the winning state to ensure solvability
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
        btn.style.visibility = "hidden"; // The vacant space
      } else {
        btn.textContent = num;
        btn.onclick = () => this.handleTileClick(r, c);
      }
      container.appendChild(btn);
    });
  }

  handleTileClick(r, c) {
    if (this.gameOver) return;

    // Check if clicked tile is adjacent to the vacant spot
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
    let timeLeft = this.timeLimit * 60;

    this.timerInterval = setInterval(() => {
      timeLeft--;
      const m = Math.floor(timeLeft / 60);
      const s = timeLeft % 60;
      document.getElementById("watch").textContent =
        `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

      if (timeLeft <= 0) {
        this.endGame(false);
      }
    }, 1000);
  }

  checkWin() {
    const isWin = this.tiles.every((val, i) => val === this.winningState[i]);
    if (isWin) this.endGame(true);
  }

  endGame(win) {
    this.gameOver = true;
    clearInterval(this.timerInterval);
    alert(
      win ? `Success! Solved in ${this.moves} moves.` : "Time's up! Try again.",
    );
    this.backToSetup();
  }

  backToSetup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    document.getElementById("setup-screen").style.display = "block";
    document.getElementById("game-screen").style.display = "none";
  }
}

const game = new NumPuzzleGame();
