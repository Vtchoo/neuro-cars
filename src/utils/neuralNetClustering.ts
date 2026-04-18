// Neural Network Clustering Utilities
// Cluster cars based on cosine similarity of their neural network weights

import { NeuralNet } from "../NeuralNet"
import Car from "../Car"

export interface ClusterResult {
    clusterId: number
    carIndex: number
    car: Car
    similarity: number
}

export interface ClusterGroup {
    id: number
    cars: Car[]
    centroid: number[]
    avgIntraSimlarity: number
    size: number
}

/**
 * Flatten all weights and biases of a neural network into a single vector
 */
export function flattenNetworkWeights(neuralNet: NeuralNet): number[] {
    const data = neuralNet.exportData()
    const weights: number[] = []
    
    // Flatten weight matrices
    for (const matrix of data.weights) {
        for (const row of matrix) {
            for (const weight of row) {
                weights.push(weight)
            }
        }
    }
    
    // Flatten bias matrices
    for (const matrix of data.biases) {
        for (const row of matrix) {
            for (const bias of row) {
                weights.push(bias)
            }
        }
    }
    
    return weights
}

/**
 * Normalize a vector to unit length
 */
function normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
    if (norm === 0) return vec.map(() => 0)
    return vec.map(v => v / norm)
}

/**
 * Euclidean distance between two vectors
 */
function euclideanDistance(vecA: number[], vecB: number[]): number {
    let sum = 0
    for (let i = 0; i < vecA.length; i++) {
        const d = vecA[i] - vecB[i]
        sum += d * d
    }
    return Math.sqrt(sum)
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error("Vectors must have the same length")
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i]
        normA += vecA[i] * vecA[i]
        normB += vecB[i] * vecB[i]
    }
    
    normA = Math.sqrt(normA)
    normB = Math.sqrt(normB)
    
    if (normA === 0 || normB === 0) {
        return 0
    }
    
    return dotProduct / (normA * normB)
}

/**
 * Calculate similarity matrix for all cars
 */
export function calculateSimilarityMatrix(cars: Car[]): number[][] {
    const vectors = cars.map(car => flattenNetworkWeights(car.neuralNet))
    const n = cars.length
    const matrix: number[][] = []
    
    for (let i = 0; i < n; i++) {
        matrix[i] = []
        for (let j = 0; j < n; j++) {
            if (i === j) {
                matrix[i][j] = 1.0 // Perfect similarity with itself
            } else {
                matrix[i][j] = cosineSimilarity(vectors[i], vectors[j])
            }
        }
    }
    
    return matrix
}

/**
 * Simple k-means clustering based on cosine similarity
 */
export function kMeansClustering(cars: Car[], k: number, maxIterations: number = 100): ClusterGroup[] {
    // Sort by weight vector norm for stable, deterministic ordering within the same generation
    const rawVectors = cars.map(car => flattenNetworkWeights(car.neuralNet))
    const sortedIndices = rawVectors
        .map((vec, i) => ({ norm: vec.reduce((a, b) => a + b * b, 0), i }))
        .sort((a, b) => a.norm - b.norm)
        .map(x => x.i)
    // Spherical k-means: normalize all vectors to unit length
    const vectors = sortedIndices.map(i => normalize(rawVectors[i]))
    const sortedCars = sortedIndices.map(i => cars[i])
    const n = cars.length
    
    // Initialize centroids deterministically: pick k evenly-spaced cars by index
    let centroids: number[][] = []
    for (let i = 0; i < k; i++) {
        const idx = Math.floor(i * n / k)
        centroids.push([...vectors[idx]])
    }
    
    let assignments: number[] = new Array(n).fill(0)
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        const newAssignments: number[] = []
        
        // Assign each point to nearest centroid (smallest Euclidean distance on unit sphere)
        for (let i = 0; i < n; i++) {
            let bestCluster = 0
            let bestDist = euclideanDistance(vectors[i], centroids[0])
            
            for (let j = 1; j < k; j++) {
                const dist = euclideanDistance(vectors[i], centroids[j])
                if (dist < bestDist) {
                    bestDist = dist
                    bestCluster = j
                }
            }
            
            newAssignments.push(bestCluster)
        }
        
        // Check for convergence
        let changed = false
        for (let i = 0; i < n; i++) {
            if (assignments[i] !== newAssignments[i]) {
                changed = true
                break
            }
        }
        
        assignments = newAssignments
        
        if (!changed) {
            console.log(`K-means converged after ${iteration + 1} iterations`)
            break
        }
        
        // Update centroids (mean of assigned points)
        const newCentroids: number[][] = []
        for (let j = 0; j < k; j++) {
            const clusterPoints = []
            for (let i = 0; i < n; i++) {
                if (assignments[i] === j) {
                    clusterPoints.push(vectors[i])
                }
            }
            
            if (clusterPoints.length > 0) {
                const centroid: number[] = []
                for (let d = 0; d < vectors[0].length; d++) {
                    const sum = clusterPoints.reduce((acc, point) => acc + point[d], 0)
                    centroid.push(sum / clusterPoints.length)
                }
                newCentroids.push(centroid)
            } else {
                // Keep old centroid if no points assigned
                newCentroids.push(centroids[j])
            }
        }
        
        // Re-normalize centroids to stay on unit sphere (spherical k-means)
        centroids = newCentroids.map(normalize)
    }
    
    // Create cluster groups
    const clusters: ClusterGroup[] = []
    for (let j = 0; j < k; j++) {
        const clusterCars = []
        const clusterVectors = []
        
        for (let i = 0; i < n; i++) {
            if (assignments[i] === j) {
                clusterCars.push(sortedCars[i])
                clusterVectors.push(vectors[i])
            }
        }

        // Average Euclidean distance of members to centroid (on unit sphere)
        let avgSim = 0
        if (clusterVectors.length > 0) {
            avgSim = clusterVectors.reduce((sum, v) => sum + euclideanDistance(v, centroids[j]), 0) / clusterVectors.length
        }
        
        clusters.push({
            id: j,
            cars: clusterCars,
            centroid: centroids[j],
            avgIntraSimlarity: avgSim,
            size: clusterCars.length
        })
    }
    
    return clusters.filter(cluster => cluster.size > 0) // Remove empty clusters
}

/**
 * Hierarchical clustering using single linkage (minimum distance)
 */
export function hierarchicalClustering(cars: Car[], maxClusters: number): ClusterGroup[] {
    const similarityMatrix = calculateSimilarityMatrix(cars)
    const n = cars.length
    
    // Initialize each car as its own cluster
    let clusters: Car[][] = cars.map(car => [car])
    
    while (clusters.length > maxClusters) {
        let maxSimilarity = -1
        let mergeI = -1
        let mergeJ = -1
        
        // Find the two most similar clusters to merge
        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                // Calculate similarity between clusters (single linkage - maximum similarity)
                let clusterSimilarity = -1
                
                for (const carI of clusters[i]) {
                    for (const carJ of clusters[j]) {
                        const carIIndex = cars.indexOf(carI)
                        const carJIndex = cars.indexOf(carJ)
                        const similarity = similarityMatrix[carIIndex][carJIndex]
                        
                        if (similarity > clusterSimilarity) {
                            clusterSimilarity = similarity
                        }
                    }
                }
                
                if (clusterSimilarity > maxSimilarity) {
                    maxSimilarity = clusterSimilarity
                    mergeI = i
                    mergeJ = j
                }
            }
        }
        
        // Merge the two most similar clusters
        if (mergeI !== -1 && mergeJ !== -1) {
            clusters[mergeI] = [...clusters[mergeI], ...clusters[mergeJ]]
            clusters.splice(mergeJ, 1)
        } else {
            break // No more clusters to merge
        }
    }
    
    // Convert to ClusterGroup format
    return clusters.map((clusterCars, index) => {
        const vectors = clusterCars.map(car => flattenNetworkWeights(car.neuralNet))
        
        // Calculate centroid as mean of all vectors in cluster
        const dimensions = vectors[0].length
        const centroid: number[] = []
        
        for (let d = 0; d < dimensions; d++) {
            const sum = vectors.reduce((acc, vector) => acc + vector[d], 0)
            centroid.push(sum / vectors.length)
        }

        const avgSim = vectors.reduce((sum, v) => sum + cosineSimilarity(v, centroid), 0) / vectors.length
        
        return {
            id: index,
            cars: clusterCars,
            centroid,
            avgIntraSimlarity: avgSim,
            size: clusterCars.length
        }
    })
}

/**
 * Find the most representative car in each cluster (closest to centroid)
 */
export function findRepresentativeCars(clusters: ClusterGroup[]): Car[] {
    return clusters.map(cluster => {
        let bestCar = cluster.cars[0]
        let bestSimilarity = -1
        
        for (const car of cluster.cars) {
            const carVector = flattenNetworkWeights(car.neuralNet)
            const similarity = cosineSimilarity(carVector, cluster.centroid)
            
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity
                bestCar = car
            }
        }
        
        return bestCar
    })
}

/**
 * Analyze clustering results and provide insights
 */
export function analyzeClusters(clusters: ClusterGroup[]): string {
    let analysis = `Neural Network Clustering Analysis:\n`
    analysis += `Total clusters: ${clusters.length}\n\n`
    
    clusters.forEach((cluster) => {
        analysis += `Species ${cluster.id}:\n`
        analysis += `  Size: ${cluster.size} cars\n`
        analysis += `  Avg intra-similarity: ${cluster.avgIntraSimlarity.toFixed(3)}\n`
        analysis += `\n`
    })
    
    return analysis
}