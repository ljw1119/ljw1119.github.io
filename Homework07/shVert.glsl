#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec2 a_texCoord;

struct Material {
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

struct Light {
    vec3 position;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;

out vec3 fragPos;
out vec3 normal;
out vec3 lightingColor; // resulting color at each vertex, to fragment shader


void main() {
    if(gouraud) {
         gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);

        vec3 fragPos = vec3(u_model * vec4(a_position, 1.0));
        vec3 normal = mat3(transpose(inverse(u_model))) * a_normal;

        // ambient
        vec3 rgb = material.diffuse;
        vec3 ambient = light.ambient * rgb;

        // diffuse
        vec3 norm = normalize(normal);
        vec3 lightDir = normalize(light.position - fragPos);
        float dotNormLight = dot(norm, lightDir);
        float diff = max(dotNormLight, 0.0);
        vec3 diffuse = light.diffuse * diff * rgb;  

        // specular
        vec3 viewDir = normalize(u_viewPos - fragPos);
        vec3 reflectDir = reflect(-lightDir, norm);
        float spec = 0.0;
        if (dotNormLight > 0.0) {
            spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
        }
        vec3 specular = light.specular * spec * material.specular;  

        // ambient + diffuse + specular
        lightingColor = ambient + diffuse + specular;
        }
        else {
            fragPos = vec3(u_model * vec4(a_position, 1.0));
            normal = mat3(transpose(inverse(u_model))) * a_normal;
            gl_Position = u_projection * u_view * vec4(fragPos, 1.0);
        }
}

