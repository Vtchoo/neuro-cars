using SmartRace.Utils;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SmartRace.Core
{
    public enum ActivationFunction
    {
        Identity,
        IdentityCapped,
        Binary,
        Softsign,
        ReLU,
        Tanh,
        Sigmoid,
        LeakyRelu,
    }

    public struct NeuralNetConfig
    {
        public int Layers { get; set; }
        public int Neurons { get; set; }
        public int Inputs { get; set; }
        public int Outputs { get; set; }
        public double Range { get; set; }
        public double MutationRate { get; set; }
        public ActivationFunction Activation { get; set; }

        public NeuralNetConfig(int layers, int neurons, int inputs, int outputs, double range, double mutationRate, ActivationFunction activation)
        {
            Layers = layers;
            Neurons = neurons;
            Inputs = inputs;
            Outputs = outputs;
            Range = range;
            MutationRate = mutationRate;
            Activation = activation;
        }
    }

    public class NeuralNetData
    {
        public NeuralNetConfig Config { get; set; }
        public double[][][] Weights { get; set; }
        public double[][][] Biases { get; set; }
        public double Fitness { get; set; }
    }

    // Matrix-based Neural Network Implementation for Smart Race
    // C# class implementation with efficient matrix operations
    public class NeuralNet
    {
        public double Range { get; private set; }
        public int Layers { get; private set; }
        public int Neurons { get; private set; }
        public int Inputs { get; private set; }
        public int Outputs { get; private set; }
        public ActivationFunction Activation { get; private set; }
        public ActivationFunction OutputActivation { get; private set; } = ActivationFunction.Tanh;
        public double MutationRate { get; private set; }
        public double Fitness { get; set; } = 0;

        private double[][][] weightMatrices;
        private double[][][] biasMatrices;

        // Pre-allocated buffers for zero-allocation forward pass (one flat array per layer output)
        private double[][] _layerOutputs;

        private bool useXavierInitialization = false; // Flag to toggle Xavier initialization

        private static readonly Random random = new Random();

        public NeuralNet(int layers, int neurons, int inputs, int outputs, double range, double mutationRate, ActivationFunction activation)
        {
            Range = range;
            Layers = layers;
            Neurons = neurons;
            Inputs = inputs;
            Outputs = outputs;
            Activation = activation;
            MutationRate = mutationRate;

            if (layers == 0)
            {
                throw new ArgumentException("Your neural net must have at least 1 neuron layer");
            }

            // Initialize weight matrices
            weightMatrices = new double[layers + 1][][];

            // Input to first hidden layer
            weightMatrices[0] = CreateRandomMatrix(neurons, inputs, inputs, neurons);

            // Hidden layer to hidden layer weights
            for (int i = 1; i < layers; i++)
            {
                weightMatrices[i] = CreateRandomMatrix(neurons, neurons, neurons, neurons);
            }

            // Last hidden layer to output
            weightMatrices[layers] = CreateRandomMatrix(outputs, neurons, neurons, outputs);

            // Bias matrices
            biasMatrices = new double[layers + 1][][];
            for (int i = 0; i < layers; i++)
            {
                biasMatrices[i] = CreateRandomMatrix(neurons, 1, neurons, 1);
            }
            biasMatrices[layers] = CreateRandomMatrix(outputs, 1, neurons, 1);

            // Pre-allocate forward pass output buffers
            _layerOutputs = new double[layers + 1][];
            for (int i = 0; i < layers; i++)
                _layerOutputs[i] = new double[neurons];
            _layerOutputs[layers] = new double[outputs];
        }

        // Helper function to create random matrix with Xavier-style initialization for softsign
        private double[][] CreateRandomMatrix(int rows, int cols, int fanIn, int fanOut)
        {
            double[][] matrix = new double[rows][];
            // Modified Xavier for softsign (gentler than tanh)
            double limit = Math.Sqrt(6.0 / (fanIn + fanOut));

            for (int i = 0; i < rows; i++)
            {
                matrix[i] = new double[cols];
                for (int j = 0; j < cols; j++)
                {
                    matrix[i][j] = (random.NextDouble() - 0.5) * 2 * limit;
                }
            }
            return matrix;
        }

        // Matrix multiplication function
        private double[][] MatrixMultiply(double[][] a, double[][] b)
        {
            double[][] result = new double[a.Length][];
            for (int i = 0; i < a.Length; i++)
            {
                result[i] = new double[b[0].Length];
                for (int j = 0; j < b[0].Length; j++)
                {
                    double sum = 0;
                    for (int k = 0; k < b.Length; k++)
                    {
                        sum += a[i][k] * b[k][j];
                    }
                    result[i][j] = sum;
                }
            }
            return result;
        }

        // Add two matrices
        private double[][] MatrixAdd(double[][] a, double[][] b)
        {
            double[][] result = new double[a.Length][];
            for (int i = 0; i < a.Length; i++)
            {
                result[i] = new double[a[0].Length];
                for (int j = 0; j < a[0].Length; j++)
                {
                    result[i][j] = a[i][j] + b[i][j];
                }
            }
            return result;
        }

        // Apply activation function to matrix
        private double[][] ApplyActivation(double[][] matrix, ActivationFunction activation)
        {
            double[][] result = new double[matrix.Length][];
            for (int i = 0; i < matrix.Length; i++)
            {
                result[i] = new double[matrix[0].Length];
                for (int j = 0; j < matrix[0].Length; j++)
                {
                    result[i][j] = Activate(matrix[i][j], activation);
                }
            }
            return result;
        }

        // Forward pass through the network (zero-allocation: uses pre-allocated _layerOutputs buffers)
        public double[] Output(double[] input)
        {
            double[] prevOutput = input;

            for (int l = 0; l < weightMatrices.Length; l++)
            {
                double[][] w = weightMatrices[l];
                double[][] b = biasMatrices[l];
                double[] buf = _layerOutputs[l];
                var act = (l == weightMatrices.Length - 1) ? OutputActivation : Activation;

                for (int i = 0; i < buf.Length; i++)
                {
                    double sum = b[i][0];
                    double[] row = w[i];
                    for (int k = 0; k < prevOutput.Length; k++)
                        sum += row[k] * prevOutput[k];
                    buf[i] = Activate(sum, act);
                }

                prevOutput = buf;
            }

            return _layerOutputs[weightMatrices.Length - 1];
        }

        // Fitness management
        public void AddFitness(double value)
        {
            Fitness += value;
        }

        public void ResetFitness()
        {
            Fitness = 0;
        }

        // Export neural network data for saving
        public NeuralNetData ExportData()
        {
            return new NeuralNetData
            {
                Config = new NeuralNetConfig(Layers, Neurons, Inputs, Outputs, Range, MutationRate, Activation),
                Weights = DeepCopyMatrices(weightMatrices),
                Biases = DeepCopyMatrices(biasMatrices),
                Fitness = Fitness
            };
        }

        // Import neural network data for loading
        public static NeuralNet FromData(NeuralNetData data)
        {
            NeuralNet net = new NeuralNet(
                data.Config.Layers,
                data.Config.Neurons,
                data.Config.Inputs,
                data.Config.Outputs,
                data.Config.Range,
                data.Config.MutationRate,
                data.Config.Activation
            );

            net.weightMatrices = DeepCopyMatrices(data.Weights);
            net.biasMatrices = DeepCopyMatrices(data.Biases);
            net.Fitness = data.Fitness;

            return net;
        }

        // Helper function to get the proper initialization limit for a given layer
        private double GetInitializationLimit(int layerIndex, bool isWeight = true)
        {
            if (!useXavierInitialization)
            {
                return Range;
            }

            int fanIn, fanOut;

            if (isWeight)
            {
                if (layerIndex == 0)
                {
                    // Input to first hidden layer
                    fanIn = Inputs;
                    fanOut = Neurons;
                }
                else if (layerIndex == Layers)
                {
                    // Last hidden layer to output
                    fanIn = Neurons;
                    fanOut = Outputs;
                }
                else
                {
                    // Hidden layer to hidden layer
                    fanIn = Neurons;
                    fanOut = Neurons;
                }
            }
            else
            {
                // For biases, fanOut is always 1
                if (layerIndex == Layers)
                {
                    // Output layer bias
                    fanIn = Neurons;
                    fanOut = 1;
                }
                else
                {
                    // Hidden layer bias
                    fanIn = Neurons;
                    fanOut = 1;
                }
            }

            return Math.Sqrt(6.0 / (fanIn + fanOut));
        }

        // Mutation function
        public void Mutate()
        {
            // Mutate weight matrices
            for (int m = 0; m < weightMatrices.Length; m++)
            {
                double limit = GetInitializationLimit(m, true);
                for (int i = 0; i < weightMatrices[m].Length; i++)
                {
                    for (int j = 0; j < weightMatrices[m][i].Length; j++)
                    {
                        if (random.NextDouble() < MutationRate)
                        {
                            weightMatrices[m][i][j] = (random.NextDouble() - 0.5) * 2 * limit;
                        }
                    }
                }
            }

            // Mutate bias matrices
            for (int m = 0; m < biasMatrices.Length; m++)
            {
                double limit = GetInitializationLimit(m, false);
                for (int i = 0; i < biasMatrices[m].Length; i++)
                {
                    for (int j = 0; j < biasMatrices[m][i].Length; j++)
                    {
                        if (random.NextDouble() < MutationRate)
                        {
                            biasMatrices[m][i][j] = (random.NextDouble() - 0.5) * 2 * limit;
                        }
                    }
                }
            }
        }

        // Create a deep copy of this neural network
        public NeuralNet Copy()
        {
            NeuralNet newNet = new NeuralNet(Layers, Neurons, Inputs, Outputs, Range, MutationRate, Activation);

            // Deep copy weight matrices
            newNet.weightMatrices = DeepCopyMatrices(weightMatrices);

            // Deep copy bias matrices
            newNet.biasMatrices = DeepCopyMatrices(biasMatrices);

            newNet.Fitness = Fitness;
            return newNet;
        }

        // Breeding/Crossover function
        public static NeuralNet Breed(NeuralNet parent1, NeuralNet parent2)
        {
            NeuralNet offspring = new NeuralNet(
                parent1.Layers,
                parent1.Neurons,
                parent1.Inputs,
                parent1.Outputs,
                parent1.Range,
                parent1.MutationRate,
                parent1.Activation
            );

            // Crossover for weight matrices
            for (int m = 0; m < offspring.weightMatrices.Length; m++)
            {
                double limit = offspring.GetInitializationLimit(m, true);
                for (int i = 0; i < offspring.weightMatrices[m].Length; i++)
                {
                    for (int j = 0; j < offspring.weightMatrices[m][i].Length; j++)
                    {
                        if (random.NextDouble() > offspring.MutationRate)
                        {
                            // Select from parent (50/50 chance)
                            if (random.NextDouble() > 0.5)
                            {
                                offspring.weightMatrices[m][i][j] = parent1.weightMatrices[m][i][j];
                            }
                            else
                            {
                                offspring.weightMatrices[m][i][j] = parent2.weightMatrices[m][i][j];
                            }
                        }
                        else
                        {
                            // Mutate
                            offspring.weightMatrices[m][i][j] = (random.NextDouble() - 0.5) * 2 * limit;
                        }
                    }
                }
            }

            // Crossover for bias matrices
            for (int m = 0; m < offspring.biasMatrices.Length; m++)
            {
                double limit = offspring.GetInitializationLimit(m, false);
                for (int i = 0; i < offspring.biasMatrices[m].Length; i++)
                {
                    for (int j = 0; j < offspring.biasMatrices[m][i].Length; j++)
                    {
                        if (random.NextDouble() > offspring.MutationRate)
                        {
                            // Select from parent (50/50 chance)
                            if (random.NextDouble() > 0.5)
                            {
                                offspring.biasMatrices[m][i][j] = parent1.biasMatrices[m][i][j];
                            }
                            else
                            {
                                offspring.biasMatrices[m][i][j] = parent2.biasMatrices[m][i][j];
                            }
                        }
                        else
                        {
                            // Mutate
                            offspring.biasMatrices[m][i][j] = (random.NextDouble() - 0.5) * 2 * limit;
                        }
                    }
                }
            }

            return offspring;
        }

        // Helper method for deep copying 3D arrays
        private static double[][][] DeepCopyMatrices(double[][][] original)
        {
            double[][][] copy = new double[original.Length][][];
            for (int i = 0; i < original.Length; i++)
            {
                copy[i] = new double[original[i].Length][];
                for (int j = 0; j < original[i].Length; j++)
                {
                    copy[i][j] = new double[original[i][j].Length];
                    Array.Copy(original[i][j], copy[i][j], original[i][j].Length);
                }
            }
            return copy;
        }

        // Activation functions
        public static double Activate(double value, ActivationFunction activation)
        {
            switch (activation)
            {
                case ActivationFunction.Identity:
                    return value;
                case ActivationFunction.Binary:
                    return value > 0 ? 1 : 0;
                case ActivationFunction.Softsign:
                    return value / (1 + Math.Abs(value));
                case ActivationFunction.ReLU:
                    return value < 0 ? 0 : value;
                case ActivationFunction.Tanh:
                    return Math.Tanh(value);
                case ActivationFunction.Sigmoid:
                    return 1.0 / (1.0 + Math.Exp(-value));
                case ActivationFunction.IdentityCapped:
                    return ActivationFunctions.IdentityCapped(value);
                case ActivationFunction.LeakyRelu:
                    return ActivationFunctions.LeakyRelu(value);
                default:
                    Console.WriteLine("No valid activation function selected");
                    return value;
            }
        }
    }
}