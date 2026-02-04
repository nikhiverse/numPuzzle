// ============================================
// A* ALGORITHM IN C++ FOR SLIDING PUZZLE
// Optimized for WebAssembly compilation
// ============================================

#include <emscripten/emscripten.h>
#include <vector>
#include <queue>
#include <unordered_set>
#include <unordered_map>
#include <algorithm>
#include <cmath>
#include <cstring>

// ============================================
// PUZZLE STATE STRUCTURE
// ============================================
struct PuzzleState {
    std::vector<int> tiles;
    int emptyPos;        // Linear index of empty tile
    int gCost;           // Actual cost from start
    int hCost;           // Heuristic cost to goal
    int parent;          // Parent state index
    
    PuzzleState() : emptyPos(0), gCost(0), hCost(0), parent(-1) {}
    
    PuzzleState(const std::vector<int>& t, int empty, int g, int h, int p = -1) 
        : tiles(t), emptyPos(empty), gCost(g), hCost(h), parent(p) {}
    
    int fCost() const { 
        return gCost + hCost; 
    }
    
    // Hash function for unordered_set
    size_t hash() const {
        size_t h = 0;
        for (int tile : tiles) {
            h = h * 31 + tile;
        }
        return h;
    }
    
    bool operator==(const PuzzleState& other) const {
        return tiles == other.tiles;
    }
};

// Hash functor for unordered_set
struct StateHash {
    size_t operator()(const PuzzleState& state) const {
        return state.hash();
    }
};

// Comparison for priority queue (min-heap)
struct StateCompare {
    bool operator()(const PuzzleState& a, const PuzzleState& b) const {
        return a.fCost() > b.fCost();
    }
};

// ============================================
// A* SOLVER CLASS
// ============================================
class AStarSolver {
public:
    int size;
    int totalTiles;
    std::vector<int> goalState;
    std::unordered_map<int, int> goalPositions;
    
    AStarSolver(int gridSize) : size(gridSize), totalTiles(gridSize * gridSize) {}
    
    // Calculate Manhattan distance
    int calculateManhattan(const std::vector<int>& tiles) {
        int distance = 0;
        
        for (int i = 0; i < totalTiles; ++i) {
            int value = tiles[i];
            if (value == 0) continue;
            
            auto it = goalPositions.find(value);
            if (it == goalPositions.end()) continue;
            
            int goalIdx = it->second;
            int currentRow = i / size;
            int currentCol = i % size;
            int goalRow = goalIdx / size;
            int goalCol = goalIdx % size;
            
            distance += std::abs(currentRow - goalRow) + std::abs(currentCol - goalCol);
        }
        
        return distance;
    }
    
    // Count linear conflicts
    int countLinearConflicts(const std::vector<int>& tiles) {
        int conflicts = 0;
        
        // Row conflicts
        for (int row = 0; row < size; ++row) {
            for (int i = 0; i < size; ++i) {
                for (int j = i + 1; j < size; ++j) {
                    int idx1 = row * size + i;
                    int idx2 = row * size + j;
                    int tile1 = tiles[idx1];
                    int tile2 = tiles[idx2];
                    
                    if (tile1 == 0 || tile2 == 0) continue;
                    
                    auto it1 = goalPositions.find(tile1);
                    auto it2 = goalPositions.find(tile2);
                    if (it1 == goalPositions.end() || it2 == goalPositions.end()) continue;
                    
                    int goal1 = it1->second;
                    int goal2 = it2->second;
                    int goalRow1 = goal1 / size;
                    int goalRow2 = goal2 / size;
                    int goalCol1 = goal1 % size;
                    int goalCol2 = goal2 % size;
                    
                    if (goalRow1 == row && goalRow2 == row && goalCol1 > goalCol2) {
                        conflicts++;
                    }
                }
            }
        }
        
        // Column conflicts
        for (int col = 0; col < size; ++col) {
            for (int i = 0; i < size; ++i) {
                for (int j = i + 1; j < size; ++j) {
                    int idx1 = i * size + col;
                    int idx2 = j * size + col;
                    int tile1 = tiles[idx1];
                    int tile2 = tiles[idx2];
                    
                    if (tile1 == 0 || tile2 == 0) continue;
                    
                    auto it1 = goalPositions.find(tile1);
                    auto it2 = goalPositions.find(tile2);
                    if (it1 == goalPositions.end() || it2 == goalPositions.end()) continue;
                    
                    int goal1 = it1->second;
                    int goal2 = it2->second;
                    int goalRow1 = goal1 / size;
                    int goalRow2 = goal2 / size;
                    int goalCol1 = goal1 % size;
                    int goalCol2 = goal2 % size;
                    
                    if (goalCol1 == col && goalCol2 == col && goalRow1 > goalRow2) {
                        conflicts++;
                    }
                }
            }
        }
        
        return conflicts;
    }
    
    // Improved heuristic
    int calculateHeuristic(const std::vector<int>& tiles) {
        int manhattan = calculateManhattan(tiles);
        int conflicts = countLinearConflicts(tiles);
        return manhattan + (2 * conflicts);
    }
    
    // Generate neighbors (valid moves)
    std::vector<PuzzleState> generateNeighbors(const PuzzleState& state) {
        std::vector<PuzzleState> neighbors;
        
        int emptyRow = state.emptyPos / size;
        int emptyCol = state.emptyPos % size;
        
        int directions[4][2] = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
        
        for (int i = 0; i < 4; ++i) {
            int newRow = emptyRow + directions[i][0];
            int newCol = emptyCol + directions[i][1];
            
            if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
                std::vector<int> newTiles = state.tiles;
                int newEmptyPos = newRow * size + newCol;
                
                std::swap(newTiles[state.emptyPos], newTiles[newEmptyPos]);
                
                PuzzleState newState(newTiles, newEmptyPos, state.gCost + 1, 0, -1);
                newState.hCost = calculateHeuristic(newTiles);
                neighbors.push_back(newState);
            }
        }
        
        return neighbors;
    }
    
    bool isGoal(const std::vector<int>& tiles) {
        return tiles == goalState;
    }
    
    // Main A* search
    int solve(const std::vector<int>& startTiles, const std::vector<int>& goal, int maxStates = 100000) {
        goalState = goal;
        goalPositions.clear();
        for (int i = 0; i < totalTiles; ++i) {
            if (goal[i] != 0) {
                goalPositions[goal[i]] = i;
            }
        }
        
        int emptyPos = 0;
        for (int i = 0; i < totalTiles; ++i) {
            if (startTiles[i] == 0) {
                emptyPos = i;
                break;
            }
        }
        
        if (isGoal(startTiles)) return 0;
        
        PuzzleState startState(startTiles, emptyPos, 0, 0);
        startState.hCost = calculateHeuristic(startTiles);
        
        std::priority_queue<PuzzleState, std::vector<PuzzleState>, StateCompare> openSet;
        openSet.push(startState);
        
        std::unordered_set<size_t> closedSet;
        std::vector<PuzzleState> allStates;
        allStates.push_back(startState);
        
        int statesExplored = 0;
        
        while (!openSet.empty() && statesExplored < maxStates) {
            PuzzleState current = openSet.top();
            openSet.pop();
            
            statesExplored++;
            
            if (isGoal(current.tiles)) {
                return current.gCost;
            }
            
            size_t currentHash = current.hash();
            if (closedSet.find(currentHash) != closedSet.end()) {
                continue;
            }
            closedSet.insert(currentHash);
            
            std::vector<PuzzleState> neighbors = generateNeighbors(current);
            
            for (PuzzleState& neighbor : neighbors) {
                size_t neighborHash = neighbor.hash();
                
                if (closedSet.find(neighborHash) != closedSet.end()) {
                    continue;
                }
                
                neighbor.parent = allStates.size() - 1;
                openSet.push(neighbor);
                allStates.push_back(neighbor);
            }
        }
        
        return -1;
    }
};

// ============================================
// EXPORTED C FUNCTIONS
// ============================================
extern "C" {
    
    EMSCRIPTEN_KEEPALIVE
    int solveWithAStar(int* startTiles, int* goalTiles, int size, int totalTiles) {
        try {
            std::vector<int> start(startTiles, startTiles + totalTiles);
            std::vector<int> goal(goalTiles, goalTiles + totalTiles);
            
            AStarSolver solver(size);
            return solver.solve(start, goal);
        } catch (...) {
            return -1;
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    int solveWithAStarLimited(int* startTiles, int* goalTiles, int size, int totalTiles, int maxStates) {
        try {
            std::vector<int> start(startTiles, startTiles + totalTiles);
            std::vector<int> goal(goalTiles, goalTiles + totalTiles);
            
            AStarSolver solver(size);
            return solver.solve(start, goal, maxStates);
        } catch (...) {
            return -1;
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    int calculateManhattanDistance(int* tiles, int* winningState, int size, int totalTiles) {
        try {
            std::vector<int> tileVec(tiles, tiles + totalTiles);
            std::vector<int> goalVec(winningState, winningState + totalTiles);
            
            AStarSolver solver(size);
            for (int i = 0; i < totalTiles; ++i) {
                if (goalVec[i] != 0) {
                    solver.goalPositions[goalVec[i]] = i;
                }
            }
            
            return solver.calculateManhattan(tileVec);
        } catch (...) {
            return 0;
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    int calculateImprovedHeuristic(int* tiles, int* winningState, int size, int totalTiles) {
        try {
            std::vector<int> tileVec(tiles, tiles + totalTiles);
            std::vector<int> goalVec(winningState, winningState + totalTiles);
            
            AStarSolver solver(size);
            solver.goalState = goalVec;
            
            for (int i = 0; i < totalTiles; ++i) {
                if (goalVec[i] != 0) {
                    solver.goalPositions[goalVec[i]] = i;
                }
            }
            
            return solver.calculateHeuristic(tileVec);
        } catch (...) {
            return 0;
        }
    }
    
    EMSCRIPTEN_KEEPALIVE
    bool isSolvable(int* tiles, int size, int totalTiles) {
        try {
            int inversions = 0;
            for (int i = 0; i < totalTiles - 1; ++i) {
                if (tiles[i] == 0) continue;
                for (int j = i + 1; j < totalTiles; ++j) {
                    if (tiles[j] == 0) continue;
                    if (tiles[i] > tiles[j]) {
                        inversions++;
                    }
                }
            }
            
            int emptyRow = -1;
            for (int i = 0; i < totalTiles; ++i) {
                if (tiles[i] == 0) {
                    emptyRow = size - (i / size);
                    break;
                }
            }
            
            if (size % 2 == 1) {
                return (inversions % 2 == 0);
            } else {
                return ((inversions + emptyRow) % 2 == 1);
            }
        } catch (...) {
            return false;
        }
    }
}
