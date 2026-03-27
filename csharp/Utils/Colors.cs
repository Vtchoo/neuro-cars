using System;

namespace SmartRace.Utils
{
    public struct RGB
    {
        public int R { get; set; }
        public int G { get; set; }
        public int B { get; set; }

        public RGB(int r, int g, int b)
        {
            R = r;
            G = g;
            B = b;
        }

        public override string ToString() => $"RGB({R}, {G}, {B})";
    }

    public struct RGBA
    {
        public int R { get; set; }
        public int G { get; set; }
        public int B { get; set; }
        public double A { get; set; }

        public RGBA(int r, int g, int b, double a = 1.0)
        {
            R = r;
            G = g;
            B = b;
            A = a;
        }

        public override string ToString() => $"RGBA({R}, {G}, {B}, {A})";
    }

    public static class ColorUtils
    {
        public static RGB ConvertHSLToRGB(double h, double s, double l)
        {
            s /= 100.0;
            l /= 100.0;

            double c = (1 - Math.Abs(2 * l - 1)) * s;
            double x = c * (1 - Math.Abs((h / 60) % 2 - 1));
            double m = l - c / 2;

            double r = 0, g = 0, b = 0;
            
            if (h >= 0 && h < 60)
            {
                r = c; g = x; b = 0;
            }
            else if (h >= 60 && h < 120)
            {
                r = x; g = c; b = 0;
            }
            else if (h >= 120 && h < 180)
            {
                r = 0; g = c; b = x;
            }
            else if (h >= 180 && h < 240)
            {
                r = 0; g = x; b = c;
            }
            else if (h >= 240 && h < 300)
            {
                r = x; g = 0; b = c;
            }
            else
            {
                r = c; g = 0; b = x;
            }

            return new RGB(
                (int)Math.Round((r + m) * 255),
                (int)Math.Round((g + m) * 255),
                (int)Math.Round((b + m) * 255)
            );
        }

        public static RGBA ConvertHSLAToRGBA(double h, double s, double l, double a)
        {
            RGB rgb = ConvertHSLToRGB(h, s, l);
            return new RGBA(rgb.R, rgb.G, rgb.B, a);
        }
    }
}