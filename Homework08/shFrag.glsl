#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  
in vec2 texCoord;

struct Material {
    vec3 diffuse; // diffuse map
    vec3 specular;     // 표면의 specular color
    float shininess;   // specular 반짝임 정도
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient; // ambient 적용 strength
    vec3 diffuse; // diffuse 적용 strength
    vec3 specular; // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;
uniform int u_toonLevels;

float quantize(float value, int levels) {
    // Ensure we have at least 1 level
    levels = max(1, levels);
    
    // For toon shading, we want to divide [0,1] into discrete levels
    float step = 1.0 / float(levels);
    return floor(value / step) * step;
}

void main() {
    // ambient
    vec3 ambient = light.ambient * material.diffuse;
  	
    // diffuse 
    vec3 norm = normalize(normal);
    //vec3 lightDir = normalize(light.position - fragPos);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);

    diff = quantize(diff, u_toonLevels);
    
    vec3 diffuse = light.diffuse * diff * material.diffuse;  
    
    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        
        // Quantize specular intensity based on toon levels
        // We can also apply a threshold to make specular highlights more distinct in toon shading
        if (spec > 0.1) {
            spec = quantize(spec, u_toonLevels);
        } else {
            spec = 0.0; // Remove very faint specular highlights for more cartoon-like look
        }
    }
    vec3 specular = light.specular * spec * material.specular;  
        
    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
} 