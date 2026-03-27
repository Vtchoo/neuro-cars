using System;

namespace SmartRace.Utils
{
    public class Vector
    {
        public double X { get; set; }
        public double Y { get; set; }

        public Vector(double x, double y)
        {
            X = x;
            Y = y;
        }

        public double Heading()
        {
            return Math.Atan2(Y, X);
        }

        public Vector Add(double x, double y)
        {
            X += x;
            Y += y;
            return this;
        }

        public Vector Mult(double scalar)
        {
            if (scalar != 0)
            {
                X *= scalar;
                Y *= scalar;
            }
            return this;
        }

        public double Mag()
        {
            return Math.Sqrt(X * X + Y * Y);
        }

        public Vector Unit()
        {
            double length = Mag();
            if (length != 0)
            {
                X = X / length;
                Y = Y / length;
            }
            return this;
        }

        public static Vector Sub(Vector a, Vector b)
        {
            return new Vector(a.X - b.X, a.Y - b.Y);
        }

        public static Vector Add(Vector a, Vector b)
        {
            return new Vector(a.X + b.X, a.Y + b.Y);
        }

        public override string ToString()
        {
            return $"Vector({X}, {Y})";
        }
    }

    public static class VectorFactory
    {
        public static Vector NewVector(double x, double y)
        {
            return new Vector(x, y);
        }
    }
}