using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace SmartRace.Utils
{
    internal static class ActivationFunctions
    {
        public static double Identity(double value) => value;
        public static double IdentityCapped(double value) => Math.Max(-1, Math.Min(1, value));

        public static double Binary(double value) => value > 0 ? 1 : 0;

        public static double ReLU(double value) => value < 0 ? 0 : value;

        public static double Tanh(double value) => Math.Tanh(value);

        public static double Sigmoid(double value) => 1 / (1 + Math.Exp(-value));

        public static double Softsign(double value) => value / (1 + Math.Abs(value));

        public static double SignedLog(double value)
        {
            if (value == 0) return 0;
            double sign = Math.Sign(value);
            return sign * Math.Log10(1 + Math.Abs(value));
        }
    }
}
